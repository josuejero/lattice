import Link from "next/link";

import { prisma } from "@lattice/db";
import { env } from "@/lib/env";
import { getActiveOrgId } from "@/lib/org-context";
import { requireMembership } from "@/lib/guards";

export default async function EventsPage() {
  if (!env.EVENTS_ENABLED) return <div>Events are disabled.</div>;

  const orgId = await getActiveOrgId();
  if (!orgId) return <div>Sign in required.</div>;

  const access = await requireMembership(orgId);
  if (!access.ok) return <div>Sign in required.</div>;

  const now = new Date();
  const events = await prisma.scheduledEvent.findMany({
    where: { orgId, endUtc: { gte: now } },
    orderBy: { startUtc: "asc" },
    take: 50,
  });

  return (
    <div style={{ padding: 16 }}>
      <h1>Events</h1>
      <div style={{ marginTop: 12 }}>
        {events.length === 0 ? (
          <p>No upcoming events yet.</p>
        ) : (
          <ul>
            {events.map((e) => (
              <li key={e.id}>
                <Link href={`/events/${e.id}`}>{e.title}</Link>{" "}
                <small>
                  ({e.startUtc.toISOString()} → {e.endUtc.toISOString()})
                </small>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
