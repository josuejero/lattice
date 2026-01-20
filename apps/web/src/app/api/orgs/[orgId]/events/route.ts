import { NextResponse } from "next/server";

import { prisma } from "@lattice/db";
import { env } from "@/lib/env";
import { requireMembership } from "@/lib/guards";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await ctx.params;

  if (!env.EVENTS_ENABLED) return NextResponse.json({ error: "disabled" }, { status: 404 });

  const access = await requireMembership(orgId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const now = new Date();

  const events = await prisma.scheduledEvent.findMany({
    where: { orgId, endUtc: { gte: now } },
    orderBy: { startUtc: "asc" },
    take: 50,
    include: { attendees: { include: { user: { select: { id: true, name: true, email: true } } } } },
  });

  return NextResponse.json({ events });
}
