import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { prisma } from "@lattice/db"
import { fail, ok, ErrorCodes, logAudit, AuditActions } from "@lattice/shared"
import { requireOrgAccess } from "@/lib/guards"
import { normalizeIntervals } from "@/lib/availability/intervals"
import type { Prisma } from "@prisma/client"

export const runtime = "nodejs"

type AvailabilityTemplateWithWindows = Prisma.AvailabilityTemplateGetPayload<{
  include: { windows: true }
}>

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

/**
 * @openapi
 * /api/orgs/{orgId}/availability/me/template:
 *   parameters:
 *     - name: orgId
 *       in: path
 *       required: true
 *       schema:
 *         type: string
 *   get:
 *     summary: Retrieves the authenticated user's availability template for an organization.
 *     tags:
 *       - Availability
 *     responses:
 *       "200":
 *         description: Availability template and timezone.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     timeZone:
 *                       type: string
 *                     windows:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           dayOfWeek:
 *                             type: integer
 *                           startMinute:
 *                             type: integer
 *                           endMinute:
 *                             type: integer
 *       "401":
 *         description: Authentication required.
 *   put:
 *     summary: Stores a normalized availability template for the current user.
 *     tags:
 *       - Availability
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               timeZone:
 *                 type: string
 *               windows:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     dayOfWeek:
 *                       type: integer
 *                     startMinute:
 *                       type: integer
 *                     endMinute:
 *                       type: integer
 *             required:
 *               - windows
 *     responses:
 *       "200":
 *         description: Template saved.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     timeZone:
 *                       type: string
 *                     windows:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           dayOfWeek:
 *                             type: integer
 *                           startMinute:
 *                             type: integer
 *                           endMinute:
 *                             type: integer
 *       "400":
 *         description: Validation error.
 *       "401":
 *         description: Authentication required.
 */
function respondUnauthorized() {
  return NextResponse.json(
    fail(ErrorCodes.UNAUTHENTICATED, "unauthorized"),
    { status: 401 }
  )
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params

  try {
    const access = await requireOrgAccess(orgId, { notFoundOnFail: true })
    if (!access.ok) return access.response

    const userId = access.membership.userId

    const template: AvailabilityTemplateWithWindows | null =
      await prisma.availabilityTemplate.findUnique({
      where: { orgId_userId: { orgId, userId } },
      include: { windows: true },
    })

    const windows = (template?.windows ?? [])
      .map((w) => ({
        dayOfWeek: w.dayOfWeek,
        startMinute: w.startMinute,
        endMinute: w.endMinute,
      }))
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startMinute - b.startMinute)

    return NextResponse.json(
      ok({
        timeZone: template?.timeZone ?? "UTC",
        windows,
      })
    )
  } catch {
    return respondUnauthorized()
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params

  let access
  try {
    access = await requireOrgAccess(orgId)
  } catch {
    return respondUnauthorized()
  }

  if (!access.ok) return access.response
  const userId = access.membership.userId

  const json = await req.json().catch(() => null)
  const parsed = BodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      fail(
        ErrorCodes.VALIDATION_ERROR,
        "Invalid body",
        parsed.error.flatten()
      ),
      { status: 400 }
    )
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

  const template: AvailabilityTemplateWithWindows =
    await prisma.availabilityTemplate.upsert({
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

  await logAudit({
    orgId,
    actorUserId: userId,
    action: AuditActions.AVAILABILITY_TEMPLATE_UPDATED,
    targetType: "AvailabilityTemplate",
    targetId: template.id,
    metadata: {
      timeZone: template.timeZone,
      windowCount: template.windows.length,
    },
  });

  const windows = template.windows
    .map((w) => ({
      dayOfWeek: w.dayOfWeek,
      startMinute: w.startMinute,
      endMinute: w.endMinute,
    }))
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startMinute - b.startMinute)

  return NextResponse.json(
    ok({
      timeZone: template.timeZone,
      windows,
    })
  )
}
