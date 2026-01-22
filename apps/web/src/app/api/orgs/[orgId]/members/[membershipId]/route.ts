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

const UpdateRoleSchema = z.object({
  role: z.enum(["OWNER", "ADMIN", "LEADER", "MEMBER"]),
});

/**
 * @openapi
 * /api/orgs/{orgId}/members/{membershipId}:
 *   parameters:
 *     - name: orgId
 *       in: path
 *       required: true
 *       schema:
 *         type: string
 *     - name: membershipId
 *       in: path
 *       required: true
 *       schema:
 *         type: string
 *   patch:
 *     summary: Updates a member's role (owner-only changes).
 *     tags:
 *       - Members
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               role:
 *                 type: string
 *                 enum:
 *                   - OWNER
 *                   - ADMIN
 *                   - LEADER
 *                   - MEMBER
 *             required:
 *               - role
 *     responses:
 *       "200":
 *         description: Membership updated.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 membership:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     role:
 *                       type: string
 *       "400":
 *         description: Validation error or owner limit.
 *       "401":
 *         description: Authentication required.
 *       "403":
 *         description: Insufficient permissions.
 *   delete:
 *     summary: Removes a member from the organization.
 *     tags:
 *       - Members
 *     responses:
 *       "200":
 *         description: Membership deleted.
 *       "401":
 *         description: Authentication required.
 *       "403":
 *         description: Insufficient permissions.
 */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ orgId: string; membershipId: string }> }
) {
  const { orgId, membershipId } = await ctx.params;

  const access = await requireOrgAccess(orgId, {
    minRole: "OWNER",
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
  const parsed = UpdateRoleSchema.safeParse(body);
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

  const target = await prisma.membership.findUnique({
    where: { id: membershipId },
    select: { role: true, userId: true },
  });

  if (parsed.data.role !== "OWNER") {

    if (target?.role === "OWNER") {
      const owners = await prisma.membership.count({
        where: { orgId, role: "OWNER" },
      });
      if (owners <= 1) {
        return NextResponse.json(
          fail(ErrorCodes.MUST_HAVE_OWNER, "must_have_owner"),
          { status: 400 }
        );
      }
    }
  }

  const updated = await prisma.membership.update({
    where: { id: membershipId },
    data: { role: parsed.data.role },
    select: { id: true, role: true },
  });

  await logAudit({
    orgId,
    actorUserId: access.membership.userId,
    action: AuditActions.MEMBER_ROLE_UPDATED,
    targetType: "Membership",
    targetId: updated.id,
    metadata: {
      userId: target?.userId,
      previousRole: target?.role,
      newRole: updated.role,
    },
  });

  return NextResponse.json({ membership: updated });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ orgId: string; membershipId: string }> }
) {
  const { orgId, membershipId } = await ctx.params;

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

  const target = await prisma.membership.findUnique({
    where: { id: membershipId },
    select: { role: true, userId: true },
  });

  if (target?.role === "OWNER") {
    const owners = await prisma.membership.count({
      where: { orgId, role: "OWNER" },
    });
    if (owners <= 1) {
    return NextResponse.json(
      fail(ErrorCodes.MUST_HAVE_OWNER, "must_have_owner"),
      { status: 400 }
    );
    }
  }

  await prisma.membership.delete({ where: { id: membershipId } });

  await logAudit({
    orgId,
    actorUserId: access.membership.userId,
    action: AuditActions.MEMBER_REMOVED,
    targetType: "Membership",
    targetId: membershipId,
    metadata: {
      userId: target?.userId,
      role: target?.role,
    },
  });
  return NextResponse.json(ok({}));
}
