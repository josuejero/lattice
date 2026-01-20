import { NextRequest, NextResponse } from "next/server"

import { prisma } from "@lattice/db"
import { requireMembership } from "@/lib/guards"

export const runtime = "nodejs"

export async function GET(
  _req: NextRequest,
  { params }: { params: { orgId: string; userId: string } }
) {
  const { orgId, userId } = params

  try {
    const access = await requireMembership(orgId, { minRole: "LEADER", notFoundOnFail: true })
    if (!access.ok) {
      return NextResponse.json({ error: "forbidden" }, { status: access.status })
    }

    const template = await prisma.availabilityTemplate.findUnique({
      where: { orgId_userId: { orgId, userId } },
      include: { windows: true },
    })

    const overrides = await prisma.availabilityOverride.findMany({
      where: { orgId, userId },
      orderBy: { startAt: "asc" },
    })

    return NextResponse.json({
      timeZone: template?.timeZone ?? "UTC",
      windows:
        template?.windows
          .map((w) => ({ dayOfWeek: w.dayOfWeek, startMinute: w.startMinute, endMinute: w.endMinute }))
          .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startMinute - b.startMinute) ?? [],
      overrides: overrides.map((o) => ({
        id: o.id,
        startAt: o.startAt.toISOString(),
        endAt: o.endAt.toISOString(),
        kind: o.kind,
        note: o.note,
      })),
    })
  } catch (error) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
}
