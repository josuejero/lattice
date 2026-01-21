import { prisma } from "@lattice/db";
import { logAudit, AuditActions } from "@lattice/shared";
import { auth } from "@/auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { setActiveOrgId, getActiveOrgId } from "@/lib/org-context";
import { env } from "@/lib/env";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
      select: { id: true, slug: true },
    });

    await logAudit({
      orgId: org.id,
      actorUserId: userId,
      action: AuditActions.ORG_CREATED,
      targetType: "Org",
      targetId: org.id,
      metadata: { name, slug: org.slug },
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
    <main className="space-y-8 px-6 py-8">
      <section className="space-y-4 rounded-2xl border border-border bg-background/70 p-6 shadow-sm">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Switch organizations, create new ones, and navigate to the features you
            use most.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <form action={switchOrg} className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Select
              name="orgId"
              defaultValue={activeOrgId ?? ""}
              className="w-full sm:w-[240px]"
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select an org…" />
              </SelectTrigger>
              <SelectContent>
                {orgs.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button type="submit" variant="secondary">
              Switch org
            </Button>
          </form>

          <p className="text-sm text-muted-foreground">
            Active org: <span className="font-semibold">{activeOrgId ?? "(none)"}</span>
          </p>
        </div>

        <Link
          href="/availability"
          className="text-sm font-medium text-primary hover:underline"
        >
          Go to availability management
        </Link>
      </section>

      <section className="rounded-2xl border border-border bg-background/60 p-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold">Create an org</h2>
          <p className="text-sm text-muted-foreground">
            Give it a descriptive name so the slug stays readable.
          </p>
        </div>
        <form action={createOrg} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <Input
            name="name"
            placeholder="e.g. Delaware DSA"
            required
            className="w-full"
          />
          <Button type="submit">Create</Button>
        </form>
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-background/60 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Your orgs</h2>
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            {orgs.length} total
          </span>
        </div>
        <div className="space-y-3">
          {orgs.map((org) => (
            <div
              key={org.id}
              className="flex flex-wrap items-baseline gap-2 rounded-xl border border-border/60 bg-muted/5 px-4 py-3"
            >
              <span className="font-medium">{org.name}</span>
              <span className="text-sm text-muted-foreground">/{org.slug}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          {env.SUGGESTIONS_ENABLED && (
            <Link
              href="/suggestions"
              className="text-primary hover:underline"
            >
              Suggestions (Phase 3)
            </Link>
          )}
          {env.EVENTS_ENABLED && (
            <Link
              href="/events"
              className="text-primary hover:underline"
            >
              Events (Phase 5)
            </Link>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-background/60 p-6">
        <h2 className="text-xl font-semibold">Audit log</h2>
        <p className="text-sm text-muted-foreground">
          Admins can inspect the most recent audit events for the active organization.
        </p>
        <Link href="/audit" className="mt-3 inline-flex text-sm font-medium text-primary hover:underline">
          View audit log
        </Link>
      </section>
    </main>
  );
}
