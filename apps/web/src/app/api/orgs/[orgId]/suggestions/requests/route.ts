import { NextResponse } from "next/server"
import { z } from "zod"
import { DateTime } from "luxon"

import { prisma } from "@lattice/db"
import {
  fail,
  ok,
  ErrorCodes,
  getRedisClient,
  logAudit,
  AuditActions,
  buildRateLimitKey,
  buildRetryAfterHeader,
  enforceRateLimit,
} from "@lattice/shared"
import { loadSuggestionAvailabilityState } from "@/lib/suggestions/state"
import { requireOrgAccess } from "@/lib/guards"
import { parseHHMM } from "@/lib/availability/time"
import { computeRequestKey, generateSuggestions } from "@/lib/suggestions/engine"
import { env } from "@/lib/env"

export const runtime = "nodejs"

const CreateSchema = z.object({
  title: z.string().max(80).optional(),
  timeZone: z.string().min(1),
  rangeStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rangeEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  durationMinutes: z.number().int().min(15).max(240),
  stepMinutes: z.number().int().min(5).max(60).default(15),
  dayStart: z.string().regex(/^\d{2}:\d{2}$/).default("08:00"),
  dayEnd: z.string().regex(/^\d{2}:\d{2}$/).default("20:00"),
  attendeeUserIds: z.array(z.string().min(1)).min(1),
})

const SUGGESTION_CACHE_TTL_SECONDS = env.NODE_ENV === "production" ? 240 : 60

type SuggestionsCacheEntry = {
  requestId: string
  candidateIds: string[]
}

function ensureSortedUnique(ids: string[]) {
  return [...new Set(ids)].sort()
}

async function requireLeader(orgId: string) {
  return requireOrgAccess(orgId, { minRole: "LEADER" })
}

/**
 * @openapi
 * /api/orgs/{orgId}/suggestions/requests:
 *   parameters:
 *     - name: orgId
 *       in: path
 *       required: true
 *       schema:
 *         type: string
 *   get:
 *     summary: Lists cached suggestion requests for leaders.
 *     tags:
 *       - Suggestions
 *     responses:
 *       "200":
 *         description: Recent suggestion requests with top candidates.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     requests:
 *                       type: array
 *   post:
 *     summary: Creates or refreshes a suggestion request.
 *     tags:
 *       - Suggestions
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               timeZone:
 *                 type: string
 *               rangeStart:
 *                 type: string
 *               rangeEnd:
 *                 type: string
 *               durationMinutes:
 *                 type: integer
 *               stepMinutes:
 *                 type: integer
 *               dayStart:
 *                 type: string
 *               dayEnd:
 *                 type: string
 *               attendeeUserIds:
 *                 type: array
 *                 items:
 *                   type: string
 *             required:
 *               - timeZone
 *               - rangeStart
 *               - rangeEnd
 *               - durationMinutes
 *               - attendeeUserIds
 *     responses:
 *       "200":
 *         description: Suggestions generated and stored.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     request:
 *                       type: object
 *                     candidates:
 *                       type: array
 *       "400":
 *         description: Validation error.
 *       "404":
 *         description: Feature disabled.
 */
export async function GET(_req: Request, { params }: { params: { orgId: string } }) {
  if (!env.SUGGESTIONS_ENABLED) {
    return NextResponse.json(
      fail(ErrorCodes.NOT_FOUND, "Not found"),
      { status: 404 }
    )
  }

  const access = await requireLeader(params.orgId)
  if (!access.ok) {
    return access.response
  }

  const requests = await prisma.suggestionRequest.findMany({
    where: { orgId: access.membership.orgId },
    orderBy: { createdAt: "desc" },
    take: 25,
    include: {
      attendees: true,
      candidates: { orderBy: { rank: "asc" }, take: 5 },
    },
  })

  return NextResponse.json(ok({ requests }))
}

export async function POST(req: Request, { params }: { params: { orgId: string } }) {
  if (!env.SUGGESTIONS_ENABLED) {
    return NextResponse.json(
      fail(ErrorCodes.NOT_FOUND, "Not found"),
      { status: 404 }
    )
  }

  const access = await requireLeader(params.orgId)
  if (!access.ok) {
    return access.response
  }

  const suggestionLimit = await enforceRateLimit(
    "suggestions",
    buildRateLimitKey(
      "suggestions",
      [access.membership.orgId, access.membership.userId]
    )
  )
  if (!suggestionLimit.allowed) {
    return NextResponse.json(
      suggestionLimit.response,
      {
        status: 429,
        headers: buildRetryAfterHeader(suggestionLimit.retryAfterSeconds),
      }
    )
  }

  const body = CreateSchema.parse(await req.json())

  const attendeeUserIds = ensureSortedUnique(body.attendeeUserIds)

  const dayStartMinute = parseHHMM(body.dayStart)
  const dayEndMinute = parseHHMM(body.dayEnd)
  if (dayStartMinute >= dayEndMinute) {
    return NextResponse.json(
      fail(ErrorCodes.VALIDATION_ERROR, "dayStart must be before dayEnd"),
      { status: 400 }
    )
  }

  const rangeStartUtc = DateTime.fromISO(body.rangeStart, { zone: body.timeZone }).startOf("day").toUTC()
  const rangeEndUtc = DateTime.fromISO(body.rangeEnd, { zone: body.timeZone }).endOf("day").toUTC()

  if (!rangeStartUtc.isValid || !rangeEndUtc.isValid || rangeStartUtc > rangeEndUtc) {
    return NextResponse.json(
      fail(ErrorCodes.INVALID_DATE_RANGE, "Invalid date range"),
      { status: 400 }
    )
  }

  const requestKey = computeRequestKey({
    timeZone: body.timeZone,
    rangeStart: body.rangeStart,
    rangeEnd: body.rangeEnd,
    durationMinutes: body.durationMinutes,
    stepMinutes: body.stepMinutes,
    dayStartMinute,
    dayEndMinute,
    attendeeUserIds,
  })

  const availabilityState = await loadSuggestionAvailabilityState({
    orgId: access.membership.orgId,
    attendeeUserIds,
    rangeStart: rangeStartUtc.toJSDate(),
    rangeEnd: rangeEndUtc.toJSDate(),
  })

  const { templates, overrides, busyBlocks, dataFingerprint } = availabilityState

  const templateByUser = new Map(templates.map((t) => [t.userId, t] as const))
  const overridesByUser = new Map<string, typeof overrides>()
  for (const override of overrides) {
    const list = overridesByUser.get(override.userId) ?? []
    list.push(override)
    overridesByUser.set(override.userId, list)
  }

  const attendees = attendeeUserIds.map((userId) => {
    const template = templateByUser.get(userId)
    const timeZone = template?.timeZone ?? body.timeZone

    return {
      userId,
      timeZone,
      windows:
        template?.windows.map((window) => ({
          dayOfWeek: window.dayOfWeek,
          startMinute: window.startMinute,
          endMinute: window.endMinute,
        })) ?? [],
      overrides: [
        ...(overridesByUser.get(userId) ?? []).map((override) => ({
          startAt: override.startAt.toISOString(),
          endAt: override.endAt.toISOString(),
          kind: override.kind,
        })),
        ...busyBlocks
          .filter((b) => b.userId === userId)
          .map((b) => ({
            startAt: b.startUtc.toISOString(),
            endAt: b.endUtc.toISOString(),
            kind: "UNAVAILABLE" as const,
          })),
      ],
    }
  })

  const cacheKey = `suggestions:${access.membership.orgId}:${requestKey}:${dataFingerprint}`

  const redisClient = await getRedisClient().catch(() => null)
  let cacheEntry: SuggestionsCacheEntry | null = null
  if (redisClient) {
    try {
      const cachedValue = await redisClient.get(cacheKey)
      if (cachedValue) {
        cacheEntry = parseSuggestionsCacheEntry(cachedValue)
      }
    } catch (error) {
      console.warn("[redis] failed to read cached suggestions", error)
    }
  }

  const existing = await prisma.suggestionRequest.findUnique({
    where: { orgId_requestKey: { orgId: access.membership.orgId, requestKey } },
    select: { id: true },
  })

  const shouldUseCache = Boolean(cacheEntry && existing && cacheEntry.requestId === existing.id)

  const requestPayload = {
    title: body.title,
    timeZone: body.timeZone,
    rangeStart: rangeStartUtc.toJSDate(),
    rangeEnd: rangeEndUtc.toJSDate(),
    durationMinutes: body.durationMinutes,
    stepMinutes: body.stepMinutes,
    dayStartMinute,
    dayEndMinute,
    dataFingerprint,
  }

  let requestResult: { id: string }

  if (shouldUseCache && existing) {
    requestResult = await prisma.suggestionRequest.update({
      where: { id: existing.id },
      data: requestPayload,
    })
  } else {
    const generated = generateSuggestions({
      timeZone: body.timeZone,
      rangeStart: body.rangeStart,
      rangeEnd: body.rangeEnd,
      durationMinutes: body.durationMinutes,
      stepMinutes: body.stepMinutes,
      dayStartMinute,
      dayEndMinute,
      attendees,
      maxCandidates: 25,
    })

    const candidatesCreate = generated.map((candidate) => ({
      rank: candidate.rank,
      startAt: new Date(candidate.startAt),
      endAt: new Date(candidate.endAt),
      attendanceRatio: candidate.attendanceRatio,
      scoreTotal: candidate.score.total,
      scoreAttendance: candidate.score.attendance,
      scoreInconvenience: candidate.score.inconvenience,
      scoreFairness: candidate.score.fairness,
      availableUserIds: candidate.availableUserIds,
      missingUserIds: candidate.missingUserIds,
      explanation: candidate.explanation,
    }))

    requestResult = await prisma.$transaction(async (tx) => {
      const existingTx = await tx.suggestionRequest.findUnique({
        where: { orgId_requestKey: { orgId: access.membership.orgId, requestKey } },
        include: { attendees: true },
      })

      const requestData = {
        ...requestPayload,
        attendees: {
          createMany: {
            data: attendeeUserIds.map((userId) => ({ userId })),
          },
        },
        candidates: {
          createMany: {
            data: candidatesCreate,
          },
        },
      }

      if (existingTx) {
        await tx.suggestionCandidate.deleteMany({ where: { requestId: existingTx.id } })
        await tx.suggestionRequestAttendee.deleteMany({ where: { requestId: existingTx.id } })

        return tx.suggestionRequest.update({
          where: { id: existingTx.id },
          data: requestData,
        })
      }

      return tx.suggestionRequest.create({
        data: {
          orgId: access.membership.orgId,
          createdById: access.membership.userId,
          requestKey,
          ...requestData,
        },
      })
    })
  }

  const hydrated = await prisma.suggestionRequest.findUnique({
    where: { id: requestResult.id },
    include: {
      attendees: true,
      candidates: { orderBy: { rank: "asc" } },
    },
  })

  if (!hydrated) {
    return NextResponse.json(
      fail(ErrorCodes.NOT_FOUND, "Failed to load request"),
      { status: 404 }
    )
  }

  await logAudit({
    orgId: access.membership.orgId,
    actorUserId: access.membership.userId,
    action: AuditActions.SUGGESTION_REQUEST_CREATED,
    targetType: "SuggestionRequest",
    targetId: hydrated.id,
    metadata: {
      requestKey,
      attendeeCount: attendeeUserIds.length,
      candidateCount: hydrated.candidates.length,
      isRefresh: Boolean(existing),
    },
  });

  if (redisClient) {
    try {
      const cachePayload: SuggestionsCacheEntry = {
        requestId: requestResult.id,
        candidateIds: hydrated.candidates.map((candidate) => candidate.id),
      }
      await redisClient.set(cacheKey, JSON.stringify(cachePayload), {
        EX: SUGGESTION_CACHE_TTL_SECONDS,
      })
    } catch (error) {
      console.warn("[redis] failed to cache suggestions", error)
    }
  }

  return NextResponse.json(
    ok({
      request: {
        id: hydrated.id,
        orgId: hydrated.orgId,
        timeZone: hydrated.timeZone,
        rangeStart: hydrated.rangeStart.toISOString(),
        rangeEnd: hydrated.rangeEnd.toISOString(),
        durationMinutes: hydrated.durationMinutes,
        stepMinutes: hydrated.stepMinutes,
        dayStartMinute: hydrated.dayStartMinute,
        dayEndMinute: hydrated.dayEndMinute,
        attendeeUserIds: hydrated.attendees.map((item) => item.userId),
      },
      candidates: hydrated.candidates.map((candidate) => ({
        rank: candidate.rank,
        startAt: candidate.startAt.toISOString(),
        endAt: candidate.endAt.toISOString(),
        attendanceRatio: candidate.attendanceRatio,
        score: {
          total: candidate.scoreTotal,
          attendance: candidate.scoreAttendance,
          inconvenience: candidate.scoreInconvenience,
          fairness: candidate.scoreFairness,
        },
        availableUserIds: candidate.availableUserIds,
        missingUserIds: candidate.missingUserIds,
        explanation: candidate.explanation,
      })),
    })
  )
}

function parseSuggestionsCacheEntry(value: string): SuggestionsCacheEntry | null {
  try {
    const parsed = JSON.parse(value)
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof parsed.requestId === "string" &&
      Array.isArray(parsed.candidateIds) &&
      parsed.candidateIds.every((candidateId) => typeof candidateId === "string")
    ) {
      return parsed
    }
  } catch {
    // ignore invalid cache payload
  }
  return null
}
