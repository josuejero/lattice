import { NextResponse } from "next/server"
import { z } from "zod"
import { DateTime } from "luxon"

import { prisma } from "@lattice/db"
import { requireMembership } from "@/lib/guards"
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

function ensureSortedUnique(ids: string[]) {
  return [...new Set(ids)].sort()
}

async function requireLeader(orgId: string) {
  const access = await requireMembership(orgId, { minRole: "LEADER" })
  if (!access.ok) {
    return { ok: false as const, status: access.status }
  }
  return { ok: true as const, membership: access.membership! }
}

export async function GET(_req: Request, { params }: { params: { orgId: string } }) {
  if (!env.SUGGESTIONS_ENABLED) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const access = await requireLeader(params.orgId)
  if (!access.ok) {
    return NextResponse.json({ error: "not_found" }, { status: access.status })
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

  return NextResponse.json({ requests })
}

export async function POST(req: Request, { params }: { params: { orgId: string } }) {
  if (!env.SUGGESTIONS_ENABLED) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const access = await requireLeader(params.orgId)
  if (!access.ok) {
    return NextResponse.json({ error: "not_found" }, { status: access.status })
  }

  const body = CreateSchema.parse(await req.json())

  const attendeeUserIds = ensureSortedUnique(body.attendeeUserIds)

  const dayStartMinute = parseHHMM(body.dayStart)
  const dayEndMinute = parseHHMM(body.dayEnd)
  if (dayStartMinute >= dayEndMinute) {
    return NextResponse.json({ error: "dayStart must be before dayEnd" }, { status: 400 })
  }

  const rangeStartUtc = DateTime.fromISO(body.rangeStart, { zone: body.timeZone }).startOf("day").toUTC()
  const rangeEndUtc = DateTime.fromISO(body.rangeEnd, { zone: body.timeZone }).endOf("day").toUTC()

  if (!rangeStartUtc.isValid || !rangeEndUtc.isValid || rangeStartUtc > rangeEndUtc) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 })
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

  const templates = await prisma.availabilityTemplate.findMany({
    where: {
      orgId: access.membership.orgId,
      userId: { in: attendeeUserIds },
    },
    include: { windows: true },
  })

  const overrides = await prisma.availabilityOverride.findMany({
    where: {
      orgId: access.membership.orgId,
      userId: { in: attendeeUserIds },
      startAt: { lt: rangeEndUtc.toJSDate() },
      endAt: { gt: rangeStartUtc.toJSDate() },
    },
    orderBy: { startAt: "asc" },
  })

  const busyBlocks = await prisma.busyBlock.findMany({
    where: {
      orgId: access.membership.orgId,
      userId: { in: attendeeUserIds },
      provider: "GOOGLE",
      startUtc: { lt: rangeEndUtc.toJSDate() },
      endUtc: { gt: rangeStartUtc.toJSDate() },
    },
    orderBy: { startUtc: "asc" },
    select: { userId: true, startUtc: true, endUtc: true },
  })

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

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.suggestionRequest.findUnique({
      where: { orgId_requestKey: { orgId: access.membership.orgId, requestKey } },
      include: { attendees: true },
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

    if (existing) {
      await tx.suggestionCandidate.deleteMany({ where: { requestId: existing.id } })
      await tx.suggestionRequestAttendee.deleteMany({ where: { requestId: existing.id } })

      return tx.suggestionRequest.update({
        where: { id: existing.id },
        data: {
          title: body.title,
          timeZone: body.timeZone,
          rangeStart: rangeStartUtc.toJSDate(),
          rangeEnd: rangeEndUtc.toJSDate(),
          durationMinutes: body.durationMinutes,
          stepMinutes: body.stepMinutes,
          dayStartMinute,
          dayEndMinute,
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
        },
      })
    }

    return tx.suggestionRequest.create({
      data: {
        orgId: access.membership.orgId,
        createdById: access.membership.userId,
        requestKey,
        title: body.title,
        timeZone: body.timeZone,
        rangeStart: rangeStartUtc.toJSDate(),
        rangeEnd: rangeEndUtc.toJSDate(),
        durationMinutes: body.durationMinutes,
        stepMinutes: body.stepMinutes,
        dayStartMinute,
        dayEndMinute,
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
      },
    })
  })

  const hydrated = await prisma.suggestionRequest.findUnique({
    where: { id: result.id },
    include: {
      attendees: true,
      candidates: { orderBy: { rank: "asc" } },
    },
  })

  return NextResponse.json({
    request: {
      id: hydrated?.id,
      orgId: hydrated?.orgId,
      timeZone: hydrated?.timeZone,
      rangeStart: hydrated?.rangeStart?.toISOString(),
      rangeEnd: hydrated?.rangeEnd?.toISOString(),
      durationMinutes: hydrated?.durationMinutes,
      stepMinutes: hydrated?.stepMinutes,
      dayStartMinute: hydrated?.dayStartMinute,
      dayEndMinute: hydrated?.dayEndMinute,
      attendeeUserIds: hydrated?.attendees.map((item) => item.userId) ?? [],
    },
    candidates:
      hydrated?.candidates.map((candidate) => ({
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
      })) ?? [],
  })
}
