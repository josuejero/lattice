import Link from "next/link";

import { prisma } from "@lattice/db";
import { env } from "@/lib/env";
import { getActiveOrgId } from "@/lib/org-context";
import { requireMembership } from "@/lib/guards";
import { WriteBackButton } from "@/features/events/WriteBackButton";

export default async function EventDetailPage(props: { params: Promise<{ eventId: string }> }) {
  if (!env.EVENTS_ENABLED) return <div>Events are disabled.</div>;

  const { eventId } = await props.params;
  const orgId = await getActiveOrgId();
  if (!orgId) return <div>Sign in required.</div>;

  const access = await requireMembership(orgId);
  if (!access.ok) return <div>Sign in required.</div>;

  const event = await prisma.scheduledEvent.findFirst({
    where: { id: eventId, orgId },
    include: { attendees: { include: { user: { select: { id: true, name: true, email: true } } } } },
  });
  if (!event) return <div>Not found.</div>;

  return (
    <div style={{ padding: 16 }}>
      <p>
        <Link href="/events">← Back</Link>
      </p>

      <h1>{event.title}</h1>
      <p>
        <strong>Time:</strong> {event.startUtc.toISOString()} → {event.endUtc.toISOString()} ({event.timeZone})
      </p>

      {event.notes ? (
        <p>
          <strong>Notes:</strong> {event.notes}
        </p>
      ) : null}

      <p>
        <strong>Write-back:</strong> {event.writeBackStatus}
        {event.externalEventHtmlLink ? (
          <>
            {" "}
            ·{" "}
            <a href={event.externalEventHtmlLink} target="_blank" rel="noreferrer">
              Open in Google Calendar
            </a>
          </>
        ) : null}
      </p>

      {env.GCAL_WRITEBACK_ENABLED ? (
        <div style={{ marginTop: 12 }}>
          <WriteBackButton orgId={orgId} eventId={event.id} />
        </div>
      ) : null}

      <h2 style={{ marginTop: 16 }}>Attendees</h2>
      <ul>
        {event.attendees.map((a) => (
          <li key={a.id}>
            {a.user.name ?? a.user.email ?? a.user.id} - <small>{a.rsvp}</small>
          </li>
        ))}
      </ul>
    </div>
  );
}
