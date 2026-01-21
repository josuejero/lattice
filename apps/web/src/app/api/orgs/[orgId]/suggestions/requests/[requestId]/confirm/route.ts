import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@lattice/db";
import { fail, ok, ErrorCodes, logAudit, AuditActions } from "@lattice/shared";
import { env } from "@/lib/env";
import { requireOrgAccess } from "@/lib/guards";
import { createGoogleCalendarEvent } from "@/lib/google/calendar";
import { findConflictingUserIds } from "@/lib/events/conflicts";
import {
  getIdempotencyResponse,
  saveIdempotencyResponse,
  computeIdempotencyHash,
} from "@/lib/idempotency";
import { loadSuggestionAvailabilityState } from "@/lib/suggestions/state";

export const runtime = "nodejs";

const Body = z.object({
  candidateRank: z.number().int().positive(),
  title: z.string().min(1).max(140).optional(),
  notes: z.string().max(2000).optional(),
  writeBackToGoogle: z.boolean().optional().default(false),
  conflictCheck: z.boolean().optional().default(true),
});

async function requireLeader(orgId: string) {
  return requireOrgAccess(orgId, { minRole: "LEADER" });
}

/**
 * @openapi
 * /api/orgs/{orgId}/suggestions/requests/{requestId}/confirm:
 *   parameters:
 *     - name: orgId
 *       in: path
 *       required: true
 *       schema:
 *         type: string
 *     - name: requestId
 *       in: path
 *       required: true
 *       schema:
 *         type: string
 *   post:
 *     summary: Confirms a suggestion candidate and persists the scheduled event.
 *     tags:
 *       - Suggestions
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               candidateRank:
 *                 type: integer
 *               title:
 *                 type: string
 *               notes:
 *                 type: string
 *               writeBackToGoogle:
 *                 type: boolean
 *               conflictCheck:
 *                 type: boolean
 *             required:
 *               - candidateRank
 *     responses:
 *       "200":
 *         description: Event created or retrieved with attendees.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     event:
 *                       type: object
 *       "400":
 *         description: Validation error, invalid rank, or missing scopes.
 *       "401":
 *         description: Authentication required.
 *       "404":
 *         description: Feature disabled or request not found.
 *       "409":
 *         description: Conflict detected with busy intervals.
 */
export async function POST(req: Request, ctx: { params: Promise<{ orgId: string; requestId: string }> }) {
  const { orgId, requestId } = await ctx.params;

  if (!env.SUGGESTIONS_ENABLED || !env.EVENTS_ENABLED) {
    return NextResponse.json(
      fail(ErrorCodes.FEATURE_DISABLED, "disabled"),
      { status: 404 }
    );
  }

  const access = await requireLeader(orgId);
  if (!access.ok) return access.response;
  const userId = access.membership.userId;

  const body = Body.parse(await req.json());
  const idempotencyKeyHeader = req.headers.get("Idempotency-Key");
  const requestHash = computeIdempotencyHash({ params: { orgId, requestId }, body });

  const idempotencyResponse = await getIdempotencyResponse({
    orgId,
    endpoint: "suggestions.confirm",
    key: idempotencyKeyHeader,
    requestHash,
  });

  if (idempotencyResponse.type === "response") {
    return NextResponse.json(idempotencyResponse.response.body, {
      status: idempotencyResponse.response.status,
    });
  }

  if (idempotencyResponse.type === "conflict") {
    return NextResponse.json(
      fail(ErrorCodes.IDEMPOTENCY_CONFLICT, "idempotency_conflict"),
      { status: 409 },
    );
  }

  if (idempotencyResponse.type === "incomplete") {
    return NextResponse.json(
      fail(ErrorCodes.RATE_LIMITED, "idempotency_in_progress"),
      { status: 429 },
    );
  }

  const requestRow = await prisma.suggestionRequest.findFirst({
    where: { id: requestId, orgId },
    include: {
      candidates: { where: { rank: body.candidateRank }, take: 1 },
      attendees: { include: { user: { select: { id: true, email: true, name: true } } } },
    },
  });

  if (!requestRow) {
    return NextResponse.json(
      fail(ErrorCodes.NOT_FOUND, "not_found"),
      { status: 404 }
    );
  }

  const candidate = requestRow.candidates[0];
  if (!candidate) {
    return NextResponse.json(
      fail(ErrorCodes.BAD_CANDIDATE_RANK, "bad_candidate_rank"),
      { status: 400 }
    );
  }

  const startUtc = candidate.startAt;
  const endUtc = candidate.endAt;
  const attendeeUserIds = requestRow.attendees.map((a) => a.userId);

  const availabilityState = await loadSuggestionAvailabilityState({
    orgId,
    attendeeUserIds,
    rangeStart: requestRow.rangeStart,
    rangeEnd: requestRow.rangeEnd,
  });

  if (
    requestRow.dataFingerprint &&
    requestRow.dataFingerprint !== availabilityState.dataFingerprint
  ) {
    return NextResponse.json(
      fail(ErrorCodes.CONFLICT, "conflict_detected", {
        previousFingerprint: requestRow.dataFingerprint,
        currentFingerprint: availabilityState.dataFingerprint,
      }),
      { status: 409 },
    );
  }

  if (body.conflictCheck && attendeeUserIds.length) {
    const busyConflicts = availabilityState.busyBlocks.filter((block) =>
      intervalsOverlap(startUtc, endUtc, block.startUtc, block.endUtc),
    );
    const overrideConflicts = availabilityState.overrides.filter(
      (override) =>
        override.kind === "UNAVAILABLE" &&
        intervalsOverlap(startUtc, endUtc, override.startAt, override.endAt),
    );

    const conflictUserIds = findConflictingUserIds({
      intervalStart: startUtc,
      intervalEnd: endUtc,
      intervals: [
        ...busyConflicts.map((block) => ({ userId: block.userId, start: block.startUtc, end: block.endUtc })),
        ...overrideConflicts.map((override) => ({ userId: override.userId, start: override.startAt, end: override.endAt })),
      ],
    });

    await logAudit({
      orgId,
      actorUserId: userId,
      action: AuditActions.ACCEPTANCE_CHECK,
      targetType: "SuggestionRequest",
      targetId: requestRow.id,
      metadata: {
        candidateRank: body.candidateRank,
        conflictDetected: conflictUserIds.length > 0,
        conflictUserIds,
      },
    });

    if (conflictUserIds.length) {
      return NextResponse.json(
        fail(ErrorCodes.CONFLICT, "conflict", { conflictUserIds }),
        { status: 409 },
      );
    }
  }

  const event = await prisma.$transaction(async (tx) => {
    const existing = await tx.scheduledEvent.findFirst({
      where: { sourceRequestId: requestId, sourceCandidateRank: body.candidateRank },
      include: { attendees: { include: { user: { select: { id: true, email: true, name: true } } } } },
    });
    if (existing) return existing;

    const created = await tx.scheduledEvent.create({
      data: {
        orgId,
        title: body.title ?? requestRow.title ?? "Scheduled event",
        notes: body.notes ?? null,
        startUtc,
        endUtc,
        timeZone: requestRow.timeZone,
        sourceRequestId: requestId,
        sourceCandidateRank: body.candidateRank,
        createdById: userId,
        confirmedById: userId,
      },
    });

    await tx.scheduledEventAttendee.createMany({
      data: attendeeUserIds.map((attendeeId) => ({
        eventId: created.id,
        userId: attendeeId,
        rsvp: attendeeId === userId ? "ACCEPTED" : "INVITED",
      })),
      skipDuplicates: true,
    });

    return tx.scheduledEvent.findUniqueOrThrow({
      where: { id: created.id },
      include: { attendees: { include: { user: { select: { id: true, email: true, name: true } } } } },
    });
  });

  if (body.writeBackToGoogle && env.GCAL_WRITEBACK_ENABLED) {
    try {
      await prisma.scheduledEvent.update({
        where: { id: event.id },
        data: { writeBackStatus: "PENDING", externalProvider: "google", externalCalendarId: "primary" },
      });

      const conn = await prisma.calendarConnection.findFirst({
        where: { userId, provider: "GOOGLE", status: "ACTIVE" },
      });
      if (!conn) throw new Error("No active Google Calendar connection for this user");

      if (
        !conn.scopes?.includes("calendar.events") &&
        !conn.scopes?.includes("https://www.googleapis.com/auth/calendar.events")
      ) {
        throw new Error("Missing write scope. Reconnect Google Calendar with write-back enabled.");
      }

      const attendees = event.attendees
        .map((a) => a.user.email)
        .filter((email): email is string => Boolean(email))
        .map((email) => ({ email }));

      const created = await createGoogleCalendarEvent({
        refreshTokenCiphertext: conn.encryptedRefreshToken,
        calendarId: "primary",
        summary: event.title,
        description: event.notes ?? undefined,
        startISO: event.startUtc.toISOString(),
        endISO: event.endUtc.toISOString(),
        timeZone: event.timeZone,
        attendees,
        sendUpdates: "all",
      });

      await prisma.scheduledEvent.update({
        where: { id: event.id },
        data: {
          writeBackStatus: "SUCCESS",
          externalEventId: created.id ?? null,
          externalEventHtmlLink: (created as any).htmlLink ?? null,
          writeBackError: null,
        },
      });

      await logAudit({
        orgId,
        actorUserId: userId,
        action: AuditActions.WRITEBACK_ATTEMPTED,
        targetType: "ScheduledEvent",
        targetId: event.id,
        metadata: {
          source: "suggestions.confirm",
          success: true,
        },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      await prisma.scheduledEvent.update({
        where: { id: event.id },
        data: { writeBackStatus: "ERROR", writeBackError: message },
      });

      await logAudit({
        orgId,
        actorUserId: userId,
        action: AuditActions.WRITEBACK_ATTEMPTED,
        targetType: "ScheduledEvent",
        targetId: event.id,
        metadata: {
          source: "suggestions.confirm",
          success: false,
          error: message,
        },
      });
    }
  }

  const refreshed = await prisma.scheduledEvent.findUnique({
    where: { id: event.id },
    include: { attendees: { include: { user: { select: { id: true, email: true, name: true } } } } },
  });

  await logAudit({
    orgId,
    actorUserId: userId,
    action: AuditActions.SLOT_CONFIRMED,
    targetType: "ScheduledEvent",
    targetId: refreshed?.id ?? event.id,
    metadata: {
      requestId,
      candidateRank: body.candidateRank,
      startUtc: event.startUtc.toISOString(),
      endUtc: event.endUtc.toISOString(),
    },
  });

  const payload = ok({ event: refreshed });
  try {
    await saveIdempotencyResponse({
      orgId,
      endpoint: "suggestions.confirm",
      key: idempotencyKeyHeader,
      requestHash,
      responseStatus: 200,
      responseBody: payload,
    });
  } catch (error) {
    console.warn("[idempotency] failed to persist confirm response", error);
  }

  return NextResponse.json(payload);
}

function intervalsOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return bStart < aEnd && bEnd > aStart;
}
