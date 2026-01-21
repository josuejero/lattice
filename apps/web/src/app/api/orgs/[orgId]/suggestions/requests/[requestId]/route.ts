import { NextResponse } from "next/server"

import { prisma } from "@lattice/db"
import { fail, ok, ErrorCodes } from "@lattice/shared"
import { requireOrgAccess } from "@/lib/guards"
import { env } from "@/lib/env"

export const runtime = "nodejs"

/**
 * @openapi
 * /api/orgs/{orgId}/suggestions/requests/{requestId}:
 *   parameters:
 *     - name: orgId
 *       in: path
 *       required: true
 *       schema:
 *         type: string
 *     - name: requestId
 *       in: path
 *       required: true
 *       schema:
 *         type: string
 *   get:
 *     summary: Retrieves a single suggestion request with candidates.
 *     tags:
 *       - Suggestions
 *     responses:
 *       "200":
 *         description: Suggestion request and candidate metadata.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     request:
 *                       type: object
 *       "401":
 *         description: Authentication required.
 *       "404":
 *         description: Request not found or feature disabled.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ orgId: string; requestId: string }> }) {
  if (!env.SUGGESTIONS_ENABLED) {
    return NextResponse.json(
      fail(ErrorCodes.NOT_FOUND, "Not found"),
      { status: 404 }
    )
  }

  const { orgId, requestId } = await params;
  const access = await requireOrgAccess(orgId, { minRole: "LEADER" })
  if (!access.ok) return access.response

  const request = await prisma.suggestionRequest.findUnique({
    where: { id: requestId },
    include: {
      attendees: true,
      candidates: { orderBy: { rank: "asc" } },
    },
  })

  if (!request || request.orgId !== orgId) {
    return NextResponse.json(
      fail(ErrorCodes.NOT_FOUND, "Not found"),
      { status: 404 }
    )
  }

  return NextResponse.json(ok({ request }))
}
