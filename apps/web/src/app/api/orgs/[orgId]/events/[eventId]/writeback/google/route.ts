import { NextResponse } from "next/server";

import { prisma } from "@lattice/db";
import { env } from "@/lib/env";
import { fail, ok, ErrorCodes, logAudit, AuditActions } from "@lattice/shared";
import { requireOrgAccess } from "@/lib/guards";
import { createGoogleCalendarEvent } from "@/lib/google/calendar";
import type { Prisma } from "@prisma/client";

type ScheduledEventWithAttendees = Prisma.ScheduledEventGetPayload<{
  include: {
    attendees: {
      include: {
        user: {
          select: {
            id: true;
            name: true;
            email: true;
          };
        };
      };
    };
  };
}>;

export const runtime = "nodejs";

/**
 * @openapi
 * /api/orgs/{orgId}/events/{eventId}/writeback/google:
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
 *   post:
 *     summary: Triggers a Google Calendar write-back for a confirmed event.
 *     tags:
 *       - Events
 *     responses:
 *       "200":
 *         description: Write-back recorded and returns external event ID.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     externalEventId:
 *                       type: string
 *                       nullable: true
 *       "400":
 *         description: No active connection.
 *       "401":
 *         description: Authentication required.
 *       "404":
 *         description: Feature disabled or event not found.
 *       "500":
 *         description: Write-back failed.
 */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ orgId: string; eventId: string }> }
) {
  const { orgId, eventId } = await ctx.params;

  if (!env.EVENTS_ENABLED || !env.GCAL_WRITEBACK_ENABLED) {
    return NextResponse.json(
      fail(ErrorCodes.FEATURE_DISABLED, "disabled"),
      { status: 404 }
    );
  }

  const access = await requireOrgAccess(orgId);
  if (!access.ok) return access.response;
  const userId = access.membership.userId;

  const event: ScheduledEventWithAttendees | null =
    await prisma.scheduledEvent.findFirst({
    where: { id: eventId, orgId },
    include: { attendees: { include: { user: { select: { id: true, name: true, email: true } } } } },
  });
  if (!event) {
    return NextResponse.json(
      fail(ErrorCodes.NOT_FOUND, "not_found"),
      { status: 404 }
    );
  }

  const conn = await prisma.calendarConnection.findFirst({
    where: { userId, provider: "GOOGLE", status: "ACTIVE" },
  });
  if (!conn) {
    return NextResponse.json(
      fail(ErrorCodes.NO_CONNECTION, "no_connection"),
      { status: 400 }
    );
  }

  await prisma.scheduledEvent.update({
    where: { id: event.id },
    data: { writeBackStatus: "PENDING", externalProvider: "google", externalCalendarId: "primary" },
  });

  try {
    if (
      !conn.scopes?.includes("calendar.events") &&
      !conn.scopes?.includes("https://www.googleapis.com/auth/calendar.events")
    ) {
      throw new Error("Missing write scope. Reconnect Google Calendar with write-back enabled.");
    }

    const attendees = event.attendees
      .map((a) => a.user.email)
      .filter((email): email is string => Boolean(email))
      .map((email) => ({ email }));

    const created = await createGoogleCalendarEvent({
      refreshTokenCiphertext: conn.encryptedRefreshToken,
      calendarId: "primary",
      summary: event.title,
      description: event.notes ?? undefined,
      startISO: event.startUtc.toISOString(),
      endISO: event.endUtc.toISOString(),
      timeZone: event.timeZone,
      attendees,
      sendUpdates: "all",
    });

      await prisma.scheduledEvent.update({
        where: { id: event.id },
        data: {
          writeBackStatus: "SUCCESS",
          externalEventId: created.id ?? null,
          externalEventHtmlLink: created.htmlLink ?? null,
          writeBackError: null,
        },
      });

    await logAudit({
      orgId,
      actorUserId: userId,
      action: AuditActions.WRITEBACK_ATTEMPTED,
      targetType: "ScheduledEvent",
      targetId: event.id,
      metadata: {
        source: "events.writeback",
        success: true,
      },
    });

    return NextResponse.json(ok({ externalEventId: created.id ?? null }));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.scheduledEvent.update({
      where: { id: event.id },
      data: { writeBackStatus: "ERROR", writeBackError: message },
    });

    await logAudit({
      orgId,
      actorUserId: userId,
      action: AuditActions.WRITEBACK_ATTEMPTED,
      targetType: "ScheduledEvent",
      targetId: event.id,
      metadata: {
        source: "events.writeback",
        success: false,
        error: message,
      },
    });
    return NextResponse.json(
      fail(ErrorCodes.SYNC_FAILED, message),
      { status: 500 }
    );
  }
}
