import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@lattice/db";
import { auth } from "@/auth";
import { slugify } from "@/lib/slugify";

export const runtime = "nodejs";

const CreateOrgSchema = z.object({
  name: z.string().min(2).max(80),
});

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const orgs = await prisma.org.findMany({
    where: { members: { some: { userId } } },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, slug: true, createdAt: true },
  });

  return NextResponse.json({ orgs });
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = CreateOrgSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const name = parsed.data.name.trim();
  const base = slugify(name) || "org";
  const slug = await allocateUniqueSlug(base);

  const org = await prisma.org.create({
    data: {
      name,
      slug,
      members: { create: { userId, role: "OWNER" } },
    },
    select: { id: true, name: true, slug: true },
  });

  return NextResponse.json({ org }, { status: 201 });
}

async function allocateUniqueSlug(base: string) {
  let slug = base;
  for (let i = 0; i < 20; i++) {
    const existing = await prisma.org.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!existing) return slug;
    slug = `${base}-${i + 2}`;
  }
  throw new Error("could_not_allocate_slug");
}
