import { NextRequest, NextResponse } from "next/server"

import { prisma } from "@lattice/db"
import { fail, ok, ErrorCodes } from "@lattice/shared"
import { requireOrgAccess } from "@/lib/guards"

export const runtime = "nodejs"

/**
 * @openapi
 * /api/orgs/{orgId}/availability/{userId}:
 *   parameters:
 *     - name: orgId
 *       in: path
 *       required: true
 *       schema:
 *         type: string
 *     - name: userId
 *       in: path
 *       required: true
 *       schema:
 *         type: string
 *   get:
 *     summary: Retrieves availability template and overrides for a specific attendee.
 *     tags:
 *       - Availability
 *     responses:
 *       "200":
 *         description: Availability data for the requested attendee.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     timeZone:
 *                       type: string
 *                     windows:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           dayOfWeek:
 *                             type: integer
 *                           startMinute:
 *                             type: integer
 *                           endMinute:
 *                             type: integer
 *                     overrides:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           startAt:
 *                             type: string
 *                             format: date-time
 *                           endAt:
 *                             type: string
 *                             format: date-time
 *                           kind:
 *                             type: string
 *                           note:
 *                             type: string
 *       "401":
 *         description: Unauthorized access.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { orgId: string; userId: string } }
) {
  const { orgId, userId } = params

  try {
    const access = await requireOrgAccess(orgId, { minRole: "LEADER", notFoundOnFail: true })
    if (!access.ok) return access.response

    const template = await prisma.availabilityTemplate.findUnique({
      where: { orgId_userId: { orgId, userId } },
      include: { windows: true },
    })

    const overrides = await prisma.availabilityOverride.findMany({
      where: { orgId, userId },
      orderBy: { startAt: "asc" },
    })

    return NextResponse.json(
      ok({
        timeZone: template?.timeZone ?? "UTC",
        windows:
          template?.windows
            .map((w) => ({
              dayOfWeek: w.dayOfWeek,
              startMinute: w.startMinute,
              endMinute: w.endMinute,
            }))
            .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startMinute - b.startMinute) ?? [],
        overrides: overrides.map((o) => ({
          id: o.id,
          startAt: o.startAt.toISOString(),
          endAt: o.endAt.toISOString(),
          kind: o.kind,
          note: o.note,
        })),
      })
    )
  } catch {
    return NextResponse.json(
      fail(ErrorCodes.UNAUTHENTICATED, "unauthorized"),
      { status: 401 }
    )
  }
}
