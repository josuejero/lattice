import { NextResponse } from "next/server";
import { prisma } from "@lattice/db";
import { ok, logAudit, AuditActions } from "@lattice/shared";
import { requireOrgAccess } from "@/lib/guards";
import { listCalendars, calendarIdHash } from "@/lib/google/calendar";

export const runtime = "nodejs";

/**
 * @openapi
 * /api/orgs/{orgId}/integrations/google/calendars:
 *   parameters:
 *     - name: orgId
 *       in: path
 *       required: true
 *       schema:
 *         type: string
 *   get:
 *     summary: Returns Google Calendar metadata and selection markers.
 *     tags:
 *       - Integrations
 *     responses:
 *       "200":
 *         description: Calendar connection status and metadata.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     connected:
 *                       type: boolean
 *                     lastSyncAt:
 *                       type: string
 *                       format: date-time
 *                     calendars:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           idHash:
 *                             type: string
 *                           summary:
 *                             type: string
 *                           primary:
 *                             type: boolean
 *                           accessRole:
 *                             type: string
 *                           isBusySource:
 *                             type: boolean
 */
export async function GET(_: Request, { params }: { params: { orgId: string } }) {
  const access = await requireOrgAccess(params.orgId);
  if (!access.ok) return access.response;

  const userId = access.membership.userId;
  const conn = await prisma.calendarConnection.findUnique({
    where: { userId_provider: { userId, provider: "GOOGLE" } },
    select: { id: true, status: true, lastSyncAt: true, encryptedRefreshToken: true },
  });
  if (!conn || conn.status !== "ACTIVE") {
    return NextResponse.json(ok({ connected: false, calendars: [] }));
  }

  const selected = await prisma.calendarSelection.findMany({
    where: { connectionId: conn.id, orgId: params.orgId, isBusySource: true },
    select: { calendarIdHash: true },
  });
  const set = new Set(selected.map((s) => s.calendarIdHash));

  const calendars = await listCalendars(conn.encryptedRefreshToken);

  return NextResponse.json(
    ok({
      connected: true,
      lastSyncAt: conn.lastSyncAt,
      calendars: calendars.map((c) => {
        const idHash = calendarIdHash(c.id);
        return {
          idHash,
          summary: c.summary ?? "(untitled)",
          primary: !!c.primary,
          accessRole: c.accessRole ?? "unknown",
          isBusySource: set.has(idHash),
        };
      }),
    })
  );
}

export async function DELETE(_: Request, { params }: { params: { orgId: string } }) {
  const access = await requireOrgAccess(params.orgId);
  if (!access.ok) return access.response;

  const userId = access.membership.userId;

  const conn = await prisma.calendarConnection.findUnique({
    where: { userId_provider: { userId, provider: "GOOGLE" } },
    select: { id: true },
  });
  if (!conn) {
    return NextResponse.json(ok({}));
  }

  await prisma.busyBlock.deleteMany({
    where: { orgId: params.orgId, userId, provider: "GOOGLE" },
  });

  await prisma.calendarConnection.delete({ where: { id: conn.id } });

  await logAudit({
    orgId: params.orgId,
    actorUserId: userId,
    action: AuditActions.CALENDAR_DISCONNECTED,
    targetType: "CalendarConnection",
    targetId: conn.id,
    metadata: {
      provider: "GOOGLE",
    },
  });

  return NextResponse.json(ok({}));
}
