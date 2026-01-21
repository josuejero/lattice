import { NextResponse } from "next/server";

import { prisma } from "@lattice/db";
import { env } from "@/lib/env";
import { fail, ok, ErrorCodes } from "@lattice/shared";
import { requireOrgAccess } from "@/lib/guards";

export const runtime = "nodejs";

/**
 * @openapi
 * /api/orgs/{orgId}/events:
 *   parameters:
 *     - name: orgId
 *       in: path
 *       required: true
 *       schema:
 *         type: string
 *   get:
 *     summary: Lists upcoming scheduled events for an organization.
 *     tags:
 *       - Events
 *     responses:
 *       "200":
 *         description: Upcoming events sorted by start time.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     events:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           title:
 *                             type: string
 *                           startUtc:
 *                             type: string
 *                             format: date-time
 *                           endUtc:
 *                             type: string
 *                             format: date-time
 *                           attendees:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 user:
 *                                   type: object
 *                                   properties:
 *                                     id:
 *                                       type: string
 *                                     name:
 *                                       type: string
 *                                     email:
 *                                       type: string
 *       "401":
 *         description: Authentication required.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await ctx.params;

  if (!env.EVENTS_ENABLED) {
    return NextResponse.json(
      fail(ErrorCodes.FEATURE_DISABLED, "disabled"),
      { status: 404 }
    );
  }

  const access = await requireOrgAccess(orgId);
  if (!access.ok) return access.response;

  const now = new Date();

  const events = await prisma.scheduledEvent.findMany({
    where: { orgId, endUtc: { gte: now } },
    orderBy: { startUtc: "asc" },
    take: 50,
    include: { attendees: { include: { user: { select: { id: true, name: true, email: true } } } } },
  });

  return NextResponse.json(ok({ events }));
}
