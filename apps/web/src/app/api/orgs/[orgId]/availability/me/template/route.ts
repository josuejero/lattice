import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { prisma } from "@lattice/db"
import { requireMembership } from "@/lib/guards"
import { normalizeIntervals } from "@/lib/availability/intervals"

export const runtime = "nodejs"

const WindowSchema = z
  .object({
    dayOfWeek: z.number().int().min(1).max(7),
    startMinute: z.number().int().min(0).max(1439),
    endMinute: z.number().int().min(1).max(1440),
  })
  .refine((w) => w.startMinute < w.endMinute, "startMinute must be < endMinute")

const BodySchema = z.object({
  timeZone: z.string().min(1).optional(),
  windows: z.array(WindowSchema).max(500),
})

function respondUnauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 })
}

export async function GET(_: NextRequest, { params }: { params: { orgId: string } }) {
  const orgId = params.orgId

  try {
    const access = await requireMembership(orgId, { notFoundOnFail: true })
    if (!access.ok) {
      return NextResponse.json({ error: "not_found" }, { status: access.status })
    }

    const userId = access.membership?.userId
    if (!userId) return respondUnauthorized()

    const template = await prisma.availabilityTemplate.findUnique({
      where: { orgId_userId: { orgId, userId } },
      include: { windows: true },
    })

    return NextResponse.json({
      timeZone: template?.timeZone ?? "UTC",
      windows:
        template?.windows
          .map((w) => ({ dayOfWeek: w.dayOfWeek, startMinute: w.startMinute, endMinute: w.endMinute }))
          .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startMinute - b.startMinute) ?? [],
    })
  } catch (error) {
    return respondUnauthorized()
  }
}

export async function PUT(req: NextRequest, { params }: { params: { orgId: string } }) {
  const orgId = params.orgId

  let access
  try {
    access = await requireMembership(orgId)
  } catch (error) {
    return respondUnauthorized()
  }

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

  const timeZone = parsed.data.timeZone ?? "UTC"

  const byDay = new Map<number, { start: number; end: number }[]>()
  for (const w of parsed.data.windows) {
    const arr = byDay.get(w.dayOfWeek) ?? []
    arr.push({ start: w.startMinute, end: w.endMinute })
    byDay.set(w.dayOfWeek, arr)
  }

  const normalizedWindows = [...byDay.entries()].flatMap(([dayOfWeek, intervals]) => {
    return normalizeIntervals(intervals).map((i) => ({ dayOfWeek, startMinute: i.start, endMinute: i.end }))
  })

  const template = await prisma.availabilityTemplate.upsert({
    where: { orgId_userId: { orgId, userId } },
    create: {
      orgId,
      userId,
      timeZone,
      windows: { create: normalizedWindows },
    },
    update: {
      timeZone,
      windows: {
        deleteMany: {},
        create: normalizedWindows,
      },
    },
    include: { windows: true },
  })

  return NextResponse.json({
    timeZone: template.timeZone,
    windows: template.windows
      .map((w) => ({ dayOfWeek: w.dayOfWeek, startMinute: w.startMinute, endMinute: w.endMinute }))
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startMinute - b.startMinute),
  })
}
