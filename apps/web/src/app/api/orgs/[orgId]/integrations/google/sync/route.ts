import { NextResponse } from "next/server";
import { z } from "zod";
import { DateTime } from "luxon";

import { prisma } from "@lattice/db";
import {
  fail,
  ok,
  ErrorCodes,
  logAudit,
  AuditActions,
  buildRateLimitKey,
  buildRetryAfterHeader,
  enforceRateLimit,
} from "@lattice/shared";
import { requireOrgAccess } from "@/lib/guards";
import {
  listCalendars,
  freeBusy,
  calendarIdHash,
  mergeUtcIntervals,
  MERGED_SOURCE_HASH,
  blockHash,
} from "@/lib/google/calendar";
import {
  getIdempotencyResponse,
  saveIdempotencyResponse,
  computeIdempotencyHash,
} from "@/lib/idempotency";
import type { CalendarSelection, Prisma } from "@prisma/client";

export const runtime = "nodejs";

const Body = z.object({
  rangeStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  rangeEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  timeZone: z.string().min(1).optional(),
});

/**
 * @openapi
 * /api/orgs/{orgId}/integrations/google/sync:
 *   parameters:
 *     - name: orgId
 *       in: path
 *       required: true
 *       schema:
 *         type: string
 *   post:
 *     summary: Fetches busy intervals from Google Calendar and records busy blocks.
 *     tags:
 *       - Integrations
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               rangeStart:
 *                 type: string
 *                 format: date
 *               rangeEnd:
 *                 type: string
 *                 format: date
 *               timeZone:
 *                 type: string
 *     responses:
 *       "200":
 *         description: Blocks synced.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     blocks:
 *                       type: integer
 *       "400":
 *         description: Validation failure or missing connection/selection.
 *       "500":
 *         description: Sync attempt failed.
 */
export async function POST(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const access = await requireOrgAccess(orgId);
  if (!access.ok) return access.response;

  const userId = access.membership.userId;
  const syncLimit = await enforceRateLimit(
    "sync",
    buildRateLimitKey("sync", [userId])
  );
  if (!syncLimit.allowed) {
    return NextResponse.json(syncLimit.response, {
      status: 429,
      headers: buildRetryAfterHeader(syncLimit.retryAfterSeconds),
    });
  }
  const body = Body.parse(await req.json());
  const idempotencyKeyHeader = req.headers.get("Idempotency-Key");
  const requestHash = computeIdempotencyHash({ params: { orgId }, body });

  const idempotencyResponse = await getIdempotencyResponse({
    orgId,
    endpoint: "integrations.google.sync",
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

  const tz = body.timeZone ?? "UTC";

  const start = DateTime.fromISO(body.rangeStart ?? DateTime.utc().toISODate()!, { zone: tz }).startOf("day").toUTC();
  const end = DateTime.fromISO(body.rangeEnd ?? DateTime.utc().plus({ days: 30 }).toISODate()!, { zone: tz }).endOf("day").toUTC();

  const startISO = start.toISO();
  const endISO = end.toISO();
  if (!startISO || !endISO) throw new Error("invalid_range");

  const conn = await prisma.calendarConnection.findUnique({
    where: { userId_provider: { userId, provider: "GOOGLE" } },
    select: { id: true, encryptedRefreshToken: true, status: true },
  });
  if (!conn || conn.status !== "ACTIVE") {
    return NextResponse.json(
      fail(ErrorCodes.NOT_CONNECTED, "not_connected"),
      { status: 400 }
    );
  }

  const selections: Pick<CalendarSelection, "calendarIdHash">[] =
    await prisma.calendarSelection.findMany({
    where: { connectionId: conn.id, orgId, isBusySource: true },
    select: { calendarIdHash: true },
  });
  const selectedHashes = new Set(selections.map((s) => s.calendarIdHash));
  if (!selectedHashes.size) {
    return NextResponse.json(
      fail(ErrorCodes.NO_CALENDARS_SELECTED, "no_calendars_selected"),
      { status: 400 }
    );
  }

  const run = await prisma.calendarSyncRun.create({
    data: {
      orgId,
      userId,
      connectionId: conn.id,
      provider: "GOOGLE",
      rangeStartUtc: start.toJSDate(),
      rangeEndUtc: end.toJSDate(),
      status: "STARTED",
    },
    select: { id: true },
  });

  await logAudit({
    orgId,
    actorUserId: userId,
    action: AuditActions.CALENDAR_SYNC_STARTED,
    targetType: "CalendarSyncRun",
    targetId: run.id,
    metadata: {
      rangeStart: startISO,
      rangeEnd: endISO,
      timeZone: tz,
    },
  });

  try {
    const calendars = await listCalendars(conn.encryptedRefreshToken);
    const busyIds = calendars.filter((c) => selectedHashes.has(calendarIdHash(c.id))).map((c) => c.id);
    if (!busyIds.length) throw new Error("selected_calendars_not_found");

    const fb = await freeBusy({
      refreshTokenCiphertext: conn.encryptedRefreshToken,
      calendarIds: busyIds,
      timeMinISO: startISO,
      timeMaxISO: endISO,
      timeZone: tz,
    });

    const intervals: Array<{ startUtc: Date; endUtc: Date }> = [];
    for (const calId of busyIds) {
      const busy = fb[calId]?.busy ?? [];
      for (const b of busy) {
        if (!b.start || !b.end) continue;
        intervals.push({ startUtc: new Date(b.start), endUtc: new Date(b.end) });
      }
    }

    const merged = mergeUtcIntervals(intervals);

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.busyBlock.deleteMany({
        where: {
          orgId,
          userId,
          provider: "GOOGLE",
          startUtc: { lt: end.toJSDate() },
          endUtc: { gt: start.toJSDate() },
        },
      });

      if (merged.length) {
        await tx.busyBlock.createMany({
          data: merged.map((m) => {
            const startISO = m.startUtc.toISOString();
            const endISO = m.endUtc.toISOString();
            return {
              orgId,
              userId,
              provider: "GOOGLE",
              sourceHash: MERGED_SOURCE_HASH,
              startUtc: m.startUtc,
              endUtc: m.endUtc,
              blockHash: blockHash({
                orgId,
                userId,
                sourceHash: MERGED_SOURCE_HASH,
                startISO,
                endISO,
              }),
            };
          }),
          skipDuplicates: true,
        });
      }

      await tx.calendarConnection.update({ where: { id: conn.id }, data: { lastSyncAt: new Date() } });
      await tx.calendarSyncRun.update({ where: { id: run.id }, data: { status: "SUCCESS", finishedAt: new Date() } });
    });

    const payload = ok({ blocks: merged.length });

    await logAudit({
      orgId,
      actorUserId: userId,
      action: AuditActions.CALENDAR_SYNC_SUCCESS,
      targetType: "CalendarSyncRun",
      targetId: run.id,
      metadata: {
        mergedBlocks: merged.length,
      },
    });
    try {
      await saveIdempotencyResponse({
        orgId,
        endpoint: "integrations.google.sync",
        key: idempotencyKeyHeader,
        requestHash,
        responseStatus: 200,
        responseBody: payload,
      });
    } catch (error) {
      console.warn("[idempotency] failed to persist sync response", error);
    }

    return NextResponse.json(payload);
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    await prisma.calendarSyncRun.update({
      where: { id: run.id },
      data: {
        status: "ERROR",
        errorCode: "SYNC_FAILED",
        errorDetail: detail,
        finishedAt: new Date(),
      },
    });

    await logAudit({
      orgId,
      actorUserId: userId,
      action: AuditActions.CALENDAR_SYNC_FAILURE,
      targetType: "CalendarSyncRun",
      targetId: run.id,
      metadata: {
        error: detail,
      },
    });
    return NextResponse.json(
      fail(ErrorCodes.SYNC_FAILED, "sync_failed", detail),
      { status: 500 }
    );
  }
}
