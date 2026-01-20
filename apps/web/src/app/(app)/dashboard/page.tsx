import { prisma } from "@lattice/db";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { setActiveOrgId, getActiveOrgId } from "@/lib/org-context";
import { env } from "@/lib/env";

export default async function Dashboard() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/signin");

  const orgs = await prisma.org.findMany({
    where: { members: { some: { userId } } },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, slug: true },
  });

  async function createOrg(formData: FormData) {
    "use server";
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) redirect("/signin");

    const name = String(formData.get("name") ?? "").trim();
    if (name.length < 2) return;

    const org = await prisma.org.create({
      data: {
        name,
        slug: name.toLowerCase().replace(/\W+/g, "-").replace(/(^-|-$)/g, ""),
        members: { create: { userId, role: "OWNER" } },
      },
      select: { id: true },
    });

    await setActiveOrgId(org.id);
    revalidatePath("/dashboard");
  }

  async function switchOrg(formData: FormData) {
    "use server";
    const orgId = String(formData.get("orgId") ?? "");
    if (!orgId) return;

    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) redirect("/signin");

    const membership = await prisma.membership.findUnique({
      where: { orgId_userId: { orgId, userId } },
      select: { id: true },
    });

    if (!membership) return;

    await setActiveOrgId(orgId);
    revalidatePath("/dashboard");
  }

  const activeOrgId = await getActiveOrgId();

  return (
    <main style={{ padding: 24, display: "grid", gap: 24 }}>
      <section style={{ display: "grid", gap: 12 }}>
        <h1>Dashboard</h1>

        <form action={switchOrg} style={{ display: "flex", gap: 8 }}>
          <select name="orgId" defaultValue={activeOrgId ?? ""}>
            <option value="" disabled>
              Select an org…
            </option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <button type="submit">Switch</button>
        </form>

        <div style={{ opacity: 0.8 }}>
          Active org: <code>{activeOrgId ?? "(none)"}</code>
        </div>
      </section>

      <section>
        <a href="/availability">Availability</a>
      </section>

      <section style={{ display: "grid", gap: 12, maxWidth: 520 }}>
        <h2>Create an org</h2>
        <form action={createOrg} style={{ display: "flex", gap: 8 }}>
          <input
            name="name"
            placeholder="e.g. Delaware DSA"
            required
            style={{ flex: 1, padding: 8 }}
          />
          <button type="submit">Create</button>
        </form>
      </section>

      <section>
        <h2>Your orgs</h2>
        <ul>
          {orgs.map((o) => (
            <li key={o.id}>
              {o.name} — <code>{o.slug}</code>
            </li>
          ))}
          {env.SUGGESTIONS_ENABLED ? (
            <li>
              <a href="/suggestions">Suggestions (Phase 3)</a>
            </li>
          ) : null}
          {env.EVENTS_ENABLED ? (
            <li>
              <a href="/events">Events (Phase 5)</a>
            </li>
          ) : null}
        </ul>
      </section>
    </main>
  );
}
