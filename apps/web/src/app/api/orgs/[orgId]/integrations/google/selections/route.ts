import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@lattice/db";
import { requireMembership } from "@/lib/guards";

export const runtime = "nodejs";

const Body = z.object({ busyCalendarIdHashes: z.array(z.string().min(32)).default([]) });

export async function PUT(req: Request, { params }: { params: { orgId: string } }) {
  const access = await requireMembership(params.orgId);
  if (!access.ok) return NextResponse.json({ error: "not_found" }, { status: access.status });

  const userId = access.session.user.id;
  const body = Body.parse(await req.json());

  const conn = await prisma.calendarConnection.findUnique({
    where: { userId_provider: { userId, provider: "GOOGLE" } },
    select: { id: true, status: true },
  });
  if (!conn || conn.status !== "ACTIVE") return NextResponse.json({ error: "not_connected" }, { status: 400 });

  const desired = new Set(body.busyCalendarIdHashes);

  await prisma.$transaction(async (tx) => {
    await tx.calendarSelection.deleteMany({ where: { connectionId: conn.id, orgId: params.orgId } });
    if (desired.size) {
      await tx.calendarSelection.createMany({
        data: [...desired].map((calendarIdHash) => ({
          connectionId: conn.id,
          orgId: params.orgId,
          calendarIdHash,
          isBusySource: true,
        })),
      });
    }
  });

  return NextResponse.json({ ok: true });
}
