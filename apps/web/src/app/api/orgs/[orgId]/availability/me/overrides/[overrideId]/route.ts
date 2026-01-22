import { NextRequest, NextResponse } from "next/server"

import { prisma } from "@lattice/db"
import { fail, ok, ErrorCodes, logAudit, AuditActions } from "@lattice/shared"
import { requireOrgAccess } from "@/lib/guards"

export const runtime = "nodejs"

function respondUnauthorized() {
  return NextResponse.json(
    fail(ErrorCodes.UNAUTHENTICATED, "unauthorized"),
    { status: 401 }
  )
}

/**
 * @openapi
 * /api/orgs/{orgId}/availability/me/overrides/{overrideId}:
 *   parameters:
 *     - name: orgId
 *       in: path
 *       required: true
 *       schema:
 *         type: string
 *     - name: overrideId
 *       in: path
 *       required: true
 *       schema:
 *         type: string
 *   delete:
 *     summary: Deletes a personal availability override.
 *     tags:
 *       - Availability
 *     responses:
 *       "200":
 *         description: Override removed.
 *       "401":
 *         description: Authentication required.
 *       "404":
 *         description: Override not found.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string; overrideId: string }> }
) {
  const { orgId, overrideId } = await params

  try {
    const access = await requireOrgAccess(orgId)
    if (!access.ok) return access.response

    const userId = access.membership.userId

    const existing = await prisma.availabilityOverride.findUnique({
      where: { id: overrideId },
      select: {
        orgId: true,
        userId: true,
        startAt: true,
        endAt: true,
        kind: true,
        note: true,
      },
    })
    if (!existing || existing.orgId !== orgId || existing.userId !== userId) {
      return NextResponse.json(
        fail(ErrorCodes.NOT_FOUND, "not_found"),
        { status: 404 }
      )
    }

    await prisma.availabilityOverride.delete({ where: { id: overrideId } })

    await logAudit({
      orgId,
      actorUserId: userId,
      action: AuditActions.AVAILABILITY_OVERRIDE_DELETED,
      targetType: "AvailabilityOverride",
      targetId: overrideId,
      metadata: {
        kind: existing.kind,
        startAt: existing.startAt.toISOString(),
        endAt: existing.endAt.toISOString(),
        note: existing.note,
      },
    });
    return NextResponse.json(ok({}))
  } catch {
    return respondUnauthorized()
  }
}
