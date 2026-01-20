import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { prisma } from "@lattice/db"
import { requireMembership } from "@/lib/guards"

export const runtime = "nodejs"

const BodySchema = z
  .object({
    startAt: z.string().datetime(),
    endAt: z.string().datetime(),
    kind: z.enum(["AVAILABLE", "UNAVAILABLE"]),
    note: z.string().max(200).optional(),
  })
  .refine((b) => new Date(b.startAt).getTime() < new Date(b.endAt).getTime(), "startAt must be < endAt")

function respondUnauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 })
}

export async function GET(req: NextRequest, { params }: { params: { orgId: string } }) {
  const orgId = params.orgId

  try {
    const access = await requireMembership(orgId, { notFoundOnFail: true })
    if (!access.ok) {
      return NextResponse.json({ error: "not_found" }, { status: access.status })
    }

    const userId = access.membership?.userId
    if (!userId) return respondUnauthorized()

    const url = new URL(req.url)
    const from = url.searchParams.get("from")
    const to = url.searchParams.get("to")

    const where: any = { orgId, userId }
    if (from || to) {
      where.AND = []
      if (from) where.AND.push({ endAt: { gte: new Date(from) } })
      if (to) where.AND.push({ startAt: { lt: new Date(to) } })
    }

    const overrides = await prisma.availabilityOverride.findMany({
      where,
      orderBy: { startAt: "asc" },
    })

    return NextResponse.json({
      overrides: overrides.map((o) => ({
        id: o.id,
        startAt: o.startAt.toISOString(),
        endAt: o.endAt.toISOString(),
        kind: o.kind,
        note: o.note,
      })),
    })
  } catch (error) {
    return respondUnauthorized()
  }
}

export async function POST(req: NextRequest, { params }: { params: { orgId: string } }) {
  const orgId = params.orgId

  try {
    const access = await requireMembership(orgId)
    if (!access.ok) {
      return NextResponse.json({ error: "forbidden" }, { status: access.status })
    }

    const userId = access.membership?.userId
    if (!userId) return respondUnauthorized()

    const json = await req.json().catch(() => null)
    const parsed = BodySchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 })
    }

    const created = await prisma.availabilityOverride.create({
      data: {
        orgId,
        userId,
        startAt: new Date(parsed.data.startAt),
        endAt: new Date(parsed.data.endAt),
        kind: parsed.data.kind,
        note: parsed.data.note,
      },
    })

    return NextResponse.json({
      override: {
        id: created.id,
        startAt: created.startAt.toISOString(),
        endAt: created.endAt.toISOString(),
        kind: created.kind,
        note: created.note,
      },
    })
  } catch (error) {
    return respondUnauthorized()
  }
}
