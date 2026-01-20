import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@lattice/db";
import { requireMembership } from "@/lib/guards";

export const runtime = "nodejs";

const UpdateOrgSchema = z.object({
  name: z.string().min(2).max(80),
});

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await ctx.params;

  const access = await requireMembership(orgId, { notFoundOnFail: true });
  if (!access.ok) {
    return NextResponse.json({ error: "not_found" }, { status: access.status });
  }

  const org = await prisma.org.findUnique({
    where: { id: orgId },
    select: { id: true, name: true, slug: true, createdAt: true },
  });

  if (!org) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ org });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await ctx.params;

  const access = await requireMembership(orgId, {
    minRole: "ADMIN",
    notFoundOnFail: true,
  });
  if (!access.ok) {
    return NextResponse.json({ error: "forbidden" }, { status: access.status });
  }

  const body = await req.json().catch(() => null);
  const parsed = UpdateOrgSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const org = await prisma.org.update({
    where: { id: orgId },
    data: { name: parsed.data.name.trim() },
    select: { id: true, name: true, slug: true },
  });

  return NextResponse.json({ org });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await ctx.params;

  const access = await requireMembership(orgId, {
    minRole: "OWNER",
    notFoundOnFail: true,
  });
  if (!access.ok) {
    return NextResponse.json({ error: "forbidden" }, { status: access.status });
  }

  await prisma.org.delete({ where: { id: orgId } });
  return NextResponse.json({ ok: true });
}
