import { NextResponse } from "next/server";
import { prisma } from "@lattice/db";
import { requireMembership } from "@/lib/guards";
import { listCalendars, calendarIdHash } from "@/lib/google/calendar";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: { orgId: string } }) {
  const access = await requireMembership(params.orgId);
  if (!access.ok) return NextResponse.json({ error: "not_found" }, { status: access.status });

  const userId = access.session.user.id;
  const conn = await prisma.calendarConnection.findUnique({
    where: { userId_provider: { userId, provider: "GOOGLE" } },
    select: { id: true, status: true, lastSyncAt: true, encryptedRefreshToken: true },
  });
  if (!conn || conn.status !== "ACTIVE") return NextResponse.json({ connected: false, calendars: [] });

  const selected = await prisma.calendarSelection.findMany({
    where: { connectionId: conn.id, orgId: params.orgId, isBusySource: true },
    select: { calendarIdHash: true },
  });
  const set = new Set(selected.map((s) => s.calendarIdHash));

  const calendars = await listCalendars(conn.encryptedRefreshToken);

  return NextResponse.json({
    connected: true,
    lastSyncAt: conn.lastSyncAt,
    calendars: calendars.map((c) => {
      const idHash = calendarIdHash(c.id);
      return {
        idHash,
        summary: c.summary ?? "(untitled)",
        primary: !!c.primary,
        accessRole: c.accessRole ?? "unknown",
        isBusySource: set.has(idHash),
      };
    }),
  });
}
