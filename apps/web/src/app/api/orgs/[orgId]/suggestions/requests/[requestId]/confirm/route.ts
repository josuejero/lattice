import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@lattice/db";
import { env } from "@/lib/env";
import { requireMembership } from "@/lib/guards";
import { roleAtLeast, type OrgRole } from "@/lib/rbac";
import { createGoogleCalendarEvent } from "@/lib/google/calendar";
import { findConflictingUserIds } from "@/lib/events/conflicts";

export const runtime = "nodejs";

const Body = z.object({
  candidateRank: z.number().int().positive(),
  title: z.string().min(1).max(140).optional(),
  notes: z.string().max(2000).optional(),
  writeBackToGoogle: z.boolean().optional().default(false),
  conflictCheck: z.boolean().optional().default(true),
});

async function requireLeader(orgId: string) {
  const access = await requireMembership(orgId);
  if (!access.ok) return access;
  const role = access.membership?.role as OrgRole | undefined;
  if (!role || !roleAtLeast(role, "LEADER")) {
    return { ok: false as const, status: 403 as const, error: "forbidden" as const };
  }
  return access;
}

function overlaps(start: Date, end: Date) {
  return { startUtc: { lt: end }, endUtc: { gt: start } };
}

export async function POST(req: Request, ctx: { params: Promise<{ orgId: string; requestId: string }> }) {
  const { orgId, requestId } = await ctx.params;

  if (!env.SUGGESTIONS_ENABLED || !env.EVENTS_ENABLED) {
    return NextResponse.json({ error: "disabled" }, { status: 404 });
  }

  const access = await requireLeader(orgId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const userId = access.membership!.userId;

  const body = Body.parse(await req.json());

  const requestRow = await prisma.suggestionRequest.findFirst({
    where: { id: requestId, orgId },
    include: {
      candidates: { where: { rank: body.candidateRank }, take: 1 },
      attendees: { include: { user: { select: { id: true, email: true, name: true } } } },
    },
  });

  if (!requestRow) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const candidate = requestRow.candidates[0];
  if (!candidate) return NextResponse.json({ error: "bad_candidate_rank" }, { status: 400 });

  const startUtc = candidate.startAt;
  const endUtc = candidate.endAt;
  const attendeeUserIds = requestRow.attendees.map((a) => a.userId);

  if (body.conflictCheck && attendeeUserIds.length) {
    const busyConflicts = await prisma.busyBlock.findMany({
      where: {
        orgId,
        userId: { in: attendeeUserIds },
        ...overlaps(startUtc, endUtc),
      },
      select: { userId: true, startUtc: true, endUtc: true },
    });

    const overrideConflicts = await prisma.availabilityOverride.findMany({
      where: {
        orgId,
        userId: { in: attendeeUserIds },
        kind: "UNAVAILABLE",
        startAt: { lt: endUtc },
        endAt: { gt: startUtc },
      },
      select: { userId: true, startAt: true, endAt: true },
    });

    const conflictUserIds = findConflictingUserIds({
      intervalStart: startUtc,
      intervalEnd: endUtc,
      intervals: [
        ...busyConflicts.map((block) => ({ userId: block.userId, start: block.startUtc, end: block.endUtc })),
        ...overrideConflicts.map((override) => ({ userId: override.userId, start: override.startAt, end: override.endAt })),
      ],
    });

    if (conflictUserIds.length) {
      return NextResponse.json({ error: "conflict", conflictUserIds }, { status: 409 });
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
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await prisma.scheduledEvent.update({
        where: { id: event.id },
        data: { writeBackStatus: "ERROR", writeBackError: message },
      });
    }
  }

  const refreshed = await prisma.scheduledEvent.findUnique({
    where: { id: event.id },
    include: { attendees: { include: { user: { select: { id: true, email: true, name: true } } } } },
  });

  return NextResponse.json({ event: refreshed });
}
