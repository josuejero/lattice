import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@lattice/db";
import { getActiveOrgId } from "@/lib/org-context";
import { requireMembership } from "@/lib/guards";
import { GoogleCalendarPanel } from "./google-calendar-panel";

export default async function IntegrationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  const userId = session.user.id;

  const orgId = await getActiveOrgId();
  if (!orgId) redirect("/dashboard");

  const access = await requireMembership(orgId);
  if (!access.ok) redirect("/dashboard");

  const conn = await prisma.calendarConnection.findUnique({
    where: { userId_provider: { userId, provider: "GOOGLE" } },
    select: { status: true, lastSyncAt: true },
  });

  const connected = !!conn && conn.status === "ACTIVE";

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Integrations</h1>

      <section className="rounded-xl border p-4 space-y-3">
        <h2 className="text-xl font-medium">Google Calendar</h2>

        {!connected ? (
          <>
            <p className="text-sm text-muted-foreground">
              Import busy time ranges only (no event titles). Busy blocks will be treated as hard “unavailable.”
            </p>
            <a className="underline" href={`/api/orgs/${orgId}/integrations/google/start`}>
              Connect Google Calendar
            </a>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Connected {conn?.lastSyncAt ? `(last sync: ${conn.lastSyncAt.toISOString()})` : "(not synced yet)"}
            </p>
            <GoogleCalendarPanel orgId={orgId} />
          </>
        )}
      </section>
    </main>
  );
}
