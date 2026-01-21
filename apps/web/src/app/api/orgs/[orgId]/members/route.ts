import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@lattice/db";
import {
  fail,
  ok,
  ErrorCodes,
  logAudit,
  AuditActions,
  buildRateLimitKey,
  buildRetryAfterHeader,
  enforceRateLimit,
} from "@lattice/shared";
import { requireOrgAccess } from "@/lib/guards";

export const runtime = "nodejs";

const AddMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(["MEMBER", "LEADER", "ADMIN"]).default("MEMBER"),
});

/**
 * @openapi
 * /api/orgs/{orgId}/members:
 *   parameters:
 *     - name: orgId
 *       in: path
 *       required: true
 *       schema:
 *         type: string
 *   get:
 *     summary: Lists the members of an organization.
 *     tags:
 *       - Members
 *     responses:
 *       "200":
 *         description: Membership roster.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     members:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           role:
 *                             type: string
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                           user:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                               email:
 *                                 type: string
 *                               name:
 *                                 type: string
 *                               image:
 *                                 type: string
 *       "401":
 *         description: Authentication required.
 *   post:
 *     summary: Invites or adds a member by email.
 *     tags:
 *       - Members
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               role:
 *                 type: string
 *                 enum:
 *                   - MEMBER
 *                   - LEADER
 *                   - ADMIN
 *             required:
 *               - email
 *     responses:
 *       "201":
 *         description: Member created.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     membership:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         role:
 *                           type: string
 *       "400":
 *         description: Validation or user not found error.
 *       "401":
 *         description: Authentication required.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await ctx.params;

  const access = await requireOrgAccess(orgId, { notFoundOnFail: true });
  if (!access.ok) return access.response;

  const members = await prisma.membership.findMany({
    where: { orgId },
    orderBy: { createdAt: "asc" },
    select: {
      userId: true,
      id: true,
      role: true,
      createdAt: true,
      user: { select: { id: true, email: true, name: true, image: true } },
    },
  });

  return NextResponse.json(ok({ members }));
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await ctx.params;

  const access = await requireOrgAccess(orgId, {
    minRole: "ADMIN",
    notFoundOnFail: true,
  });
  if (!access.ok) return access.response;

  const membershipLimit = await enforceRateLimit(
    "membership",
    buildRateLimitKey("membership", [orgId, access.membership.userId])
  );
  if (!membershipLimit.allowed) {
    return NextResponse.json(
      membershipLimit.response,
      {
        status: 429,
        headers: buildRetryAfterHeader(membershipLimit.retryAfterSeconds),
      }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = AddMemberSchema.safeParse(body);
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

  const email = parsed.data.email.toLowerCase().trim();

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json(
      fail(ErrorCodes.USER_NOT_FOUND, "user_not_found"),
      { status: 400 }
    );
  }

  const membership = await prisma.membership.create({
    data: {
      orgId,
      userId: user.id,
      role: parsed.data.role,
    },
    select: { id: true, role: true },
  });

  await logAudit({
    orgId,
    actorUserId: access.membership.userId,
    action: AuditActions.MEMBER_INVITED,
    targetType: "Membership",
    targetId: membership.id,
    metadata: {
      userId: user.id,
      email,
      role: membership.role,
    },
  });

  return NextResponse.json(ok({ membership }), { status: 201 });
}
