import { NextResponse } from "next/server";
import { z } from "zod";
import { DateTime } from "luxon";

import { prisma } from "@lattice/db";
import { requireMembership } from "@/lib/guards";
import {
  listCalendars,
  freeBusy,
  calendarIdHash,
  mergeUtcIntervals,
  MERGED_SOURCE_HASH,
  blockHash,
} from "@/lib/google/calendar";

export const runtime = "nodejs";

const Body = z.object({
  rangeStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  rangeEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  timeZone: z.string().min(1).optional(),
});

export async function POST(req: Request, { params }: { params: { orgId: string } }) {
  const access = await requireMembership(params.orgId);
  if (!access.ok) return NextResponse.json({ error: "not_found" }, { status: access.status });

  const userId = access.session.user.id;
  const body = Body.parse(await req.json());
  const tz = body.timeZone ?? "UTC";

  const start = DateTime.fromISO(body.rangeStart ?? DateTime.utc().toISODate()!, { zone: tz }).startOf("day").toUTC();
  const end = DateTime.fromISO(body.rangeEnd ?? DateTime.utc().plus({ days: 30 }).toISODate()!, { zone: tz }).endOf("day").toUTC();

  const conn = await prisma.calendarConnection.findUnique({
    where: { userId_provider: { userId, provider: "GOOGLE" } },
    select: { id: true, encryptedRefreshToken: true, status: true },
  });
  if (!conn || conn.status !== "ACTIVE") return NextResponse.json({ error: "not_connected" }, { status: 400 });

  const selections = await prisma.calendarSelection.findMany({
    where: { connectionId: conn.id, orgId: params.orgId, isBusySource: true },
    select: { calendarIdHash: true },
  });
  const selectedHashes = new Set(selections.map((s) => s.calendarIdHash));
  if (!selectedHashes.size) return NextResponse.json({ error: "no_calendars_selected" }, { status: 400 });

  const run = await prisma.calendarSyncRun.create({
    data: {
      orgId: params.orgId,
      userId,
      connectionId: conn.id,
      provider: "GOOGLE",
      rangeStartUtc: start.toJSDate(),
      rangeEndUtc: end.toJSDate(),
      status: "STARTED",
    },
    select: { id: true },
  });

  try {
    const calendars = await listCalendars(conn.encryptedRefreshToken);
    const busyIds = calendars.filter((c) => selectedHashes.has(calendarIdHash(c.id))).map((c) => c.id);
    if (!busyIds.length) throw new Error("selected_calendars_not_found");

    const fb = await freeBusy({
      refreshTokenCiphertext: conn.encryptedRefreshToken,
      calendarIds: busyIds,
      timeMinISO: start.toISO(),
      timeMaxISO: end.toISO(),
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

    await prisma.$transaction(async (tx) => {
      await tx.busyBlock.deleteMany({
        where: {
          orgId: params.orgId,
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
              orgId: params.orgId,
              userId,
              provider: "GOOGLE",
              sourceHash: MERGED_SOURCE_HASH,
              startUtc: m.startUtc,
              endUtc: m.endUtc,
              blockHash: blockHash({
                orgId: params.orgId,
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

    return NextResponse.json({ ok: true, blocks: merged.length });
  } catch (error) {
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
    return NextResponse.json({ error: "sync_failed" }, { status: 500 });
  }
}
