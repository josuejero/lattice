import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@lattice/db";
import { auth } from "@/auth";
import { slugify } from "@/lib/slugify";
import { ok, fail, ErrorCodes } from "@lattice/shared";

export const runtime = "nodejs";

const CreateOrgSchema = z.object({
  name: z.string().min(2).max(80),
});

/**
 * @openapi
 * /api/orgs:
 *   get:
 *     summary: Fetches organizations that belong to the signed-in user.
 *     tags:
 *       - Orgs
 *     responses:
 *       "200":
 *         description: Returns the organizations the user is a member of.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     orgs:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           slug:
 *                             type: string
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *       "401":
 *         description: Request was not authenticated.
 *   post:
 *     summary: Creates a new organization for the current user.
 *     tags:
 *       - Orgs
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *             required:
 *               - name
 *     responses:
 *       "201":
 *         description: Organization created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     org:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         slug:
 *                           type: string
 *       "401":
 *         description: Authentication required.
 *       "400":
 *         description: Validation error.
 */
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json(
      fail(ErrorCodes.UNAUTHENTICATED, "unauthorized"),
      { status: 401 }
    );
  }

  const orgs = await prisma.org.findMany({
    where: { members: { some: { userId } } },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, slug: true, createdAt: true },
  });

  return NextResponse.json(ok({ orgs }));
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json(
      fail(ErrorCodes.UNAUTHENTICATED, "unauthorized"),
      { status: 401 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = CreateOrgSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      fail(
        ErrorCodes.VALIDATION_ERROR,
        "invalid_input",
        parsed.error.flatten()
      ),
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

  return NextResponse.json(ok({ org }), { status: 201 });
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
