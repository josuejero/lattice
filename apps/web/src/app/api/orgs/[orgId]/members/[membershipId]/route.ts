import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@lattice/db";
import { requireMembership } from "@/lib/guards";

export const runtime = "nodejs";

const UpdateRoleSchema = z.object({
  role: z.enum(["OWNER", "ADMIN", "LEADER", "MEMBER"]),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ orgId: string; membershipId: string }> }
) {
  const { orgId, membershipId } = await ctx.params;

  const access = await requireMembership(orgId, {
    minRole: "OWNER",
    notFoundOnFail: true,
  });
  if (!access.ok) {
    return NextResponse.json({ error: "forbidden" }, { status: access.status });
  }

  const body = await req.json().catch(() => null);
  const parsed = UpdateRoleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  if (parsed.data.role !== "OWNER") {
    const target = await prisma.membership.findUnique({
      where: { id: membershipId },
      select: { role: true },
    });

    if (target?.role === "OWNER") {
      const owners = await prisma.membership.count({
        where: { orgId, role: "OWNER" },
      });
      if (owners <= 1) {
        return NextResponse.json({ error: "must_have_owner" }, { status: 400 });
      }
    }
  }

  const updated = await prisma.membership.update({
    where: { id: membershipId },
    data: { role: parsed.data.role },
    select: { id: true, role: true },
  });

  return NextResponse.json({ membership: updated });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ orgId: string; membershipId: string }> }
) {
  const { orgId, membershipId } = await ctx.params;

  const access = await requireMembership(orgId, {
    minRole: "ADMIN",
    notFoundOnFail: true,
  });
  if (!access.ok) {
    return NextResponse.json({ error: "forbidden" }, { status: access.status });
  }

  const target = await prisma.membership.findUnique({
    where: { id: membershipId },
    select: { role: true },
  });

  if (target?.role === "OWNER") {
    const owners = await prisma.membership.count({
      where: { orgId, role: "OWNER" },
    });
    if (owners <= 1) {
      return NextResponse.json({ error: "must_have_owner" }, { status: 400 });
    }
  }

  await prisma.membership.delete({ where: { id: membershipId } });
  return NextResponse.json({ ok: true });
}
