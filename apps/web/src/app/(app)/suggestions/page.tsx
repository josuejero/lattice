import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { prisma } from "@lattice/db"
import { getActiveOrgId } from "@/lib/org-context"
import { roleAtLeast } from "@/lib/rbac"
import { env } from "@/lib/env"
import SuggestionsClient from "@/features/suggestions/SuggestionsClient"

export default async function SuggestionsPage() {
  if (!env.SUGGESTIONS_ENABLED) {
    redirect("/dashboard")
  }

  const session = await auth()
  const userId = session?.user?.id ?? redirect("/signin")

  const orgId = await getActiveOrgId()
  if (!orgId) {
    redirect("/dashboard")
  }

  const membership = await prisma.membership.findUnique({
    where: { orgId_userId: { orgId, userId } },
    select: { role: true },
  })

  if (!membership || !roleAtLeast(membership.role, "LEADER")) {
    redirect("/dashboard")
  }

  const org = await prisma.org.findUnique({
    where: { id: orgId },
    select: { id: true, name: true },
  })

  if (!org) {
    redirect("/dashboard")
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>Suggestions</h1>
      <p>Create a request and get ranked meeting slots based on member availability.</p>
      <SuggestionsClient orgId={org.id} orgName={org.name} />
    </div>
  )
}
