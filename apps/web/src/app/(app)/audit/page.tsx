import { prisma } from "@lattice/db";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getActiveOrgId } from "@/lib/org-context";
import { requireOrgAccess } from "@/lib/guards";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function AuditPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const orgId = await getActiveOrgId();
  if (!orgId) redirect("/dashboard");

  const access = await requireOrgAccess(orgId, { minRole: "ADMIN" });
  if (!access.ok) redirect("/dashboard");

  const logs = await prisma.auditLog.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { actorUser: { select: { id: true, email: true, name: true } } },
  });

  return (
    <main className="mx-auto max-w-5xl p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Audit log</h1>
        <p className="text-sm text-muted-foreground">
          Latest sensitive events for this organization. Only admins can view this data.
        </p>
        <a className="text-sm underline" href="/dashboard">
          Back to dashboard
        </a>
      </div>

      <section className="rounded-xl border bg-background p-4">
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No audit events recorded yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Metadata</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => {
                const actor =
                  log.actorUser?.name ??
                  log.actorUser?.email ??
                  "system";
                const target =
                  log.targetType && log.targetId
                    ? `${log.targetType} ${log.targetId}`
                    : log.targetType ?? "(none)";
                const metadataString = log.metadata
                  ? JSON.stringify(log.metadata)
                  : "";
                const metaPreview =
                  metadataString.length > 180
                    ? `${metadataString.slice(0, 180)}…`
                    : metadataString || "-";

                return (
                  <TableRow key={log.id}>
                    <TableCell>{log.createdAt.toISOString()}</TableCell>
                    <TableCell className="font-medium">{log.action}</TableCell>
                    <TableCell>{actor}</TableCell>
                    <TableCell>{target}</TableCell>
                    <TableCell className="break-words">{metaPreview}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </section>
    </main>
  );
}
