import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@lattice/db";
import { fail, ok, ErrorCodes } from "@lattice/shared";
import { requireOrgAccess } from "@/lib/guards";

export const runtime = "nodejs";

const UpdateOrgSchema = z.object({
  name: z.string().min(2).max(80),
});

/**
 * @openapi
 * /api/orgs/{orgId}:
 *   parameters:
 *     - name: orgId
 *       in: path
 *       required: true
 *       schema:
 *         type: string
 *   get:
 *     summary: Loads organization metadata for the authenticated user.
 *     tags:
 *       - Orgs
 *     responses:
 *       "200":
 *         description: Organization details returned.
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
 *                         createdAt:
 *                           type: string
 *                           format: date-time
 *       "401":
 *         description: Authentication required.
 *       "404":
 *         description: Organization not found.
 *   patch:
 *     summary: Updates an organization name (admin+).
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
 *       "200":
 *         description: Organization updated.
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
 *       "400":
 *         description: Validation error.
 *       "401":
 *         description: Authentication required.
 *       "404":
 *         description: Not found.
 *   delete:
 *     summary: Deletes an organization (owner only).
 *     tags:
 *       - Orgs
 *     responses:
 *       "200":
 *         description: Organization removed.
 *       "401":
 *         description: Authentication required.
 *       "403":
 *         description: Insufficient permissions.
 *       "404":
 *         description: Organization not found.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await ctx.params;

  const access = await requireOrgAccess(orgId, { notFoundOnFail: true });
  if (!access.ok) return access.response;

  const org = await prisma.org.findUnique({
    where: { id: orgId },
    select: { id: true, name: true, slug: true, createdAt: true },
  });

  if (!org) {
    return NextResponse.json(
      fail(ErrorCodes.NOT_FOUND, "not_found"),
      { status: 404 }
    );
  }

  return NextResponse.json(ok({ org }));
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await ctx.params;

  const access = await requireOrgAccess(orgId, {
    minRole: "ADMIN",
    notFoundOnFail: true,
  });
  if (!access.ok) return access.response;

  const body = await req.json().catch(() => null);
  const parsed = UpdateOrgSchema.safeParse(body);
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

  const org = await prisma.org.update({
    where: { id: orgId },
    data: { name: parsed.data.name.trim() },
    select: { id: true, name: true, slug: true },
  });

  return NextResponse.json(ok({ org }));
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await ctx.params;

  const access = await requireOrgAccess(orgId, {
    minRole: "OWNER",
    notFoundOnFail: true,
  });
  if (!access.ok) return access.response;

  await prisma.org.delete({ where: { id: orgId } });
  return NextResponse.json(ok({}));
}
