import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@lattice/db";
import { fail, ok, ErrorCodes } from "@lattice/shared";
import { requireOrgAccess } from "@/lib/guards";

export const runtime = "nodejs";

const Body = z.object({ busyCalendarIdHashes: z.array(z.string().min(32)).default([]) });

/**
 * @openapi
 * /api/orgs/{orgId}/integrations/google/selections:
 *   parameters:
 *     - name: orgId
 *       in: path
 *       required: true
 *       schema:
 *         type: string
 *   put:
 *     summary: Sets the list of calendars that should be treated as busy sources.
 *     tags:
 *       - Integrations
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               busyCalendarIdHashes:
 *                 type: array
 *                 items:
 *                   type: string
 *             required:
 *               - busyCalendarIdHashes
 *     responses:
 *       "200":
 *         description: Calendar selections updated.
 *       "400":
 *         description: Validation failure or not connected.
 *       "401":
 *         description: Authentication required.
 */
export async function PUT(req: Request, { params }: { params: { orgId: string } }) {
  const access = await requireOrgAccess(params.orgId);
  if (!access.ok) return access.response;

  const userId = access.membership.userId;
  const body = Body.parse(await req.json());

  const conn = await prisma.calendarConnection.findUnique({
    where: { userId_provider: { userId, provider: "GOOGLE" } },
    select: { id: true, status: true },
  });
  if (!conn || conn.status !== "ACTIVE") {
    return NextResponse.json(
      fail(ErrorCodes.NOT_CONNECTED, "not_connected"),
      { status: 400 }
    );
  }

  const desired = new Set(body.busyCalendarIdHashes);

  await prisma.$transaction(async (tx) => {
    await tx.calendarSelection.deleteMany({ where: { connectionId: conn.id, orgId: params.orgId } });
    if (desired.size) {
      await tx.calendarSelection.createMany({
        data: [...desired].map((calendarIdHash) => ({
          connectionId: conn.id,
          orgId: params.orgId,
          calendarIdHash,
          isBusySource: true,
        })),
      });
    }
  });

  return NextResponse.json(ok({}));
}
