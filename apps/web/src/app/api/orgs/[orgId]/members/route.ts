import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@lattice/db";
import { requireMembership } from "@/lib/guards";

export const runtime = "nodejs";

const AddMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(["MEMBER", "LEADER", "ADMIN"]).default("MEMBER"),
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

  const members = await prisma.membership.findMany({
    where: { orgId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      role: true,
      createdAt: true,
      user: { select: { id: true, email: true, name: true, image: true } },
    },
  });

  return NextResponse.json({ members });
}

export async function POST(
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
  const parsed = AddMemberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const email = parsed.data.email.toLowerCase().trim();

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json({ error: "user_not_found" }, { status: 400 });
  }

  const membership = await prisma.membership.create({
    data: {
      orgId,
      userId: user.id,
      role: parsed.data.role,
    },
    select: { id: true, role: true },
  });

  return NextResponse.json({ membership }, { status: 201 });
}
