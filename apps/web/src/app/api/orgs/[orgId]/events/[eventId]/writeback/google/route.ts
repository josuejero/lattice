import { NextResponse } from "next/server";

import { prisma } from "@lattice/db";
import { env } from "@/lib/env";
import { requireMembership } from "@/lib/guards";
import { createGoogleCalendarEvent } from "@/lib/google/calendar";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ orgId: string; eventId: string }> }
) {
  const { orgId, eventId } = await ctx.params;

  if (!env.EVENTS_ENABLED || !env.GCAL_WRITEBACK_ENABLED) {
    return NextResponse.json({ error: "disabled" }, { status: 404 });
  }

  const access = await requireMembership(orgId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const userId = access.membership!.userId;

  const event = await prisma.scheduledEvent.findFirst({
    where: { id: eventId, orgId },
    include: { attendees: { include: { user: { select: { id: true, name: true, email: true } } } } },
  });
  if (!event) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const conn = await prisma.calendarConnection.findFirst({
    where: { userId, provider: "GOOGLE", status: "ACTIVE" },
  });
  if (!conn) return NextResponse.json({ error: "no_connection" }, { status: 400 });

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
        externalEventHtmlLink: (created as any).htmlLink ?? null,
        writeBackError: null,
      },
    });

    return NextResponse.json({ ok: true, externalEventId: created.id ?? null });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.scheduledEvent.update({
      where: { id: event.id },
      data: { writeBackStatus: "ERROR", writeBackError: message },
    });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
