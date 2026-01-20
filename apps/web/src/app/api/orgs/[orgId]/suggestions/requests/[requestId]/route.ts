import { NextResponse } from "next/server"

import { prisma } from "@lattice/db"
import { requireMembership } from "@/lib/guards"
import { env } from "@/lib/env"

export const runtime = "nodejs"

export async function GET(_req: Request, { params }: { params: { orgId: string; requestId: string } }) {
  if (!env.SUGGESTIONS_ENABLED) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const access = await requireMembership(params.orgId, { minRole: "LEADER" })
  if (!access.ok) {
    return NextResponse.json({ error: "not_found" }, { status: access.status })
  }

  const request = await prisma.suggestionRequest.findUnique({
    where: { id: params.requestId },
    include: {
      attendees: true,
      candidates: { orderBy: { rank: "asc" } },
    },
  })

  if (!request || request.orgId !== params.orgId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json({ request })
}
