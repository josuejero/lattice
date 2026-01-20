import { NextRequest, NextResponse } from "next/server"

import { prisma } from "@lattice/db"
import { requireMembership } from "@/lib/guards"

export const runtime = "nodejs"

function respondUnauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { orgId: string; overrideId: string } }
) {
  const { orgId, overrideId } = params

  try {
    const access = await requireMembership(orgId)
    if (!access.ok) {
      return NextResponse.json({ error: "forbidden" }, { status: access.status })
    }

    const userId = access.membership?.userId
    if (!userId) return respondUnauthorized()

    const existing = await prisma.availabilityOverride.findUnique({ where: { id: overrideId } })
    if (!existing || existing.orgId !== orgId || existing.userId !== userId) {
      return NextResponse.json({ error: "not_found" }, { status: 404 })
    }

    await prisma.availabilityOverride.delete({ where: { id: overrideId } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return respondUnauthorized()
  }
}
