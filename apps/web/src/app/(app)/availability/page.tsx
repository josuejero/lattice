import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { getActiveOrgId } from "@/lib/org-context"
import AvailabilityClient from "@/features/availability/AvailabilityClient"

export default async function AvailabilityPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/signin")

  const orgId = await getActiveOrgId()
  if (!orgId) redirect("/dashboard")

  return (
    <div style={{ padding: 24 }}>
      <h1>Availability</h1>
      <p>Set your weekly availability and add overrides for specific dates.</p>
      <AvailabilityClient orgId={orgId} />
    </div>
  )
}
