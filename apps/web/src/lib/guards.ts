import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@lattice/db";
import { fail, ErrorCodes } from "@lattice/shared";
import { roleAtLeast, type OrgRole } from "@/lib/rbac";

export async function requireUserId(): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("UNAUTHORIZED");
  return userId;
}

/**
 * Membership guard that avoids “soft leaks” by defaulting to 404.
 *
 * Guidance:
 * - Use 404 when the user is not a member (don’t confirm org existence).
 * - Use 403 when the user is a member but lacks permissions.
 */
export async function requireMembership(
  orgId: string,
  opts?: { minRole?: OrgRole; notFoundOnFail?: boolean }
) {
  const userId = await requireUserId();

  const membership = await prisma.membership.findUnique({
    where: { orgId_userId: { orgId, userId } },
    select: { id: true, role: true, orgId: true, userId: true },
  });

  if (!membership) {
    const notFoundOnFail = opts?.notFoundOnFail ?? true;
    return {
      ok: false as const,
      status: notFoundOnFail ? 404 : 403,
      membership: null,
    };
  }

  if (opts?.minRole && !roleAtLeast(membership.role as OrgRole, opts.minRole)) {
    return { ok: false as const, status: 403, membership };
  }

  return { ok: true as const, status: 200, membership };
}

type MembershipRecord = NonNullable<
  Awaited<ReturnType<typeof requireMembership>>["membership"]
>;

type OrgAccessSuccess = { ok: true; membership: MembershipRecord };
type OrgAccessFailure = { ok: false; response: NextResponse };

export async function requireOrgAccess(
  orgId: string,
  opts?: { minRole?: OrgRole; notFoundOnFail?: boolean }
): Promise<OrgAccessSuccess | OrgAccessFailure> {
  const access = await requireMembership(orgId, opts);

  if (!access.ok) {
    const code =
      access.status === 403 ? ErrorCodes.FORBIDDEN : ErrorCodes.NOT_FOUND;
    const message = access.status === 403 ? "forbidden" : "not_found";
    return {
      ok: false,
      response: NextResponse.json(fail(code, message), { status: access.status }),
    };
  }

  return { ok: true, membership: access.membership! };
}
