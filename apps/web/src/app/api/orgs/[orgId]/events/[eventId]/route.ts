import { NextResponse } from "next/server";

import { prisma } from "@lattice/db";
import { env } from "@/lib/env";
import { requireMembership } from "@/lib/guards";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ orgId: string; eventId: string }> }
) {
  const { orgId, eventId } = await ctx.params;

  if (!env.EVENTS_ENABLED) return NextResponse.json({ error: "disabled" }, { status: 404 });

  const access = await requireMembership(orgId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const event = await prisma.scheduledEvent.findFirst({
    where: { id: eventId, orgId },
    include: { attendees: { include: { user: { select: { id: true, name: true, email: true } } } } },
  });

  if (!event) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({ event });
}
