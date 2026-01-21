import { NextResponse } from "next/server";

import { prisma } from "@lattice/db";
import { env } from "@/lib/env";
import { fail, ok, ErrorCodes } from "@lattice/shared";
import { requireOrgAccess } from "@/lib/guards";

export const runtime = "nodejs";

/**
 * @openapi
 * /api/orgs/{orgId}/events/{eventId}:
 *   parameters:
 *     - name: orgId
 *       in: path
 *       required: true
 *       schema:
 *         type: string
 *     - name: eventId
 *       in: path
 *       required: true
 *       schema:
 *         type: string
 *   get:
 *     summary: Fetches details for a single scheduled event.
 *     tags:
 *       - Events
 *     responses:
 *       "200":
 *         description: Event and attendee metadata returned.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     event:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         title:
 *                           type: string
 *                         startUtc:
 *                           type: string
 *                           format: date-time
 *                         endUtc:
 *                           type: string
 *                           format: date-time
 *                         attendees:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               user:
 *                                 type: object
 *                                 properties:
 *                                   id:
 *                                     type: string
 *       "401":
 *         description: Authentication required.
 *       "404":
 *         description: Event not found.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ orgId: string; eventId: string }> }
) {
  const { orgId, eventId } = await ctx.params;

  if (!env.EVENTS_ENABLED) {
    return NextResponse.json(
      fail(ErrorCodes.FEATURE_DISABLED, "disabled"),
      { status: 404 }
    );
  }

  const access = await requireOrgAccess(orgId);
  if (!access.ok) return access.response;

  const event = await prisma.scheduledEvent.findFirst({
    where: { id: eventId, orgId },
    include: { attendees: { include: { user: { select: { id: true, name: true, email: true } } } } },
  });

  if (!event) {
    return NextResponse.json(
      fail(ErrorCodes.NOT_FOUND, "not_found"),
      { status: 404 }
    );
  }

  return NextResponse.json(ok({ event }));
}
