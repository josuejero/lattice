import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { prisma } from "@lattice/db"
import { fail, ok, ErrorCodes, logAudit, AuditActions } from "@lattice/shared"
import { requireOrgAccess } from "@/lib/guards"

export const runtime = "nodejs"

const BodySchema = z
  .object({
    startAt: z.string().datetime(),
    endAt: z.string().datetime(),
    kind: z.enum(["AVAILABLE", "UNAVAILABLE"]),
    note: z.string().max(200).optional(),
  })
  .refine((b) => new Date(b.startAt).getTime() < new Date(b.endAt).getTime(), "startAt must be < endAt")

/**
 * @openapi
 * /api/orgs/{orgId}/availability/me/overrides:
 *   parameters:
 *     - name: orgId
 *       in: path
 *       required: true
 *       schema:
 *         type: string
 *   get:
 *     summary: Lists override intervals optionally filtered by range.
 *     tags:
 *       - Availability
 *     parameters:
 *       - name: from
 *         in: query
 *         schema:
 *           type: string
 *           format: date-time
 *       - name: to
 *         in: query
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       "200":
 *         description: Overrides for the authenticated user.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     overrides:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           startAt:
 *                             type: string
 *                             format: date-time
 *                           endAt:
 *                             type: string
 *                             format: date-time
 *                           kind:
 *                             type: string
 *                           note:
 *                             type: string
 *   post:
 *     summary: Adds a new availability override for the authenticated user.
 *     tags:
 *       - Availability
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               startAt:
 *                 type: string
 *                 format: date-time
 *               endAt:
 *                 type: string
 *                 format: date-time
 *               kind:
 *                 type: string
 *                 enum:
 *                   - AVAILABLE
 *                   - UNAVAILABLE
 *               note:
 *                 type: string
 *             required:
 *               - startAt
 *               - endAt
 *               - kind
 *     responses:
 *       "200":
 *         description: Override created.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     override:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         startAt:
 *                           type: string
 *                           format: date-time
 *                         endAt:
 *                           type: string
 *                           format: date-time
 *                         kind:
 *                           type: string
 *                         note:
 *                           type: string
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

type OverrideFilter = {
  orgId: string
  userId: string
  AND?: Array<{ endAt?: { gte: Date }; startAt?: { lt: Date } }>
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params

  try {
    const access = await requireOrgAccess(orgId, { notFoundOnFail: true })
    if (!access.ok) return access.response

    const userId = access.membership.userId

    const url = new URL(req.url)
    const from = url.searchParams.get("from")
    const to = url.searchParams.get("to")

    const where: OverrideFilter = { orgId, userId }
    if (from || to) {
      where.AND = []
      if (from) where.AND.push({ endAt: { gte: new Date(from) } })
      if (to) where.AND.push({ startAt: { lt: new Date(to) } })
    }

    const overrides = await prisma.availabilityOverride.findMany({
      where,
      orderBy: { startAt: "asc" },
    })

    return NextResponse.json(
      ok({
        overrides: overrides.map((o) => ({
          id: o.id,
          startAt: o.startAt.toISOString(),
          endAt: o.endAt.toISOString(),
          kind: o.kind,
          note: o.note,
        })),
      })
    )
  } catch {
    return respondUnauthorized()
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params

  try {
    const access = await requireOrgAccess(orgId)
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

    await logAudit({
      orgId,
      actorUserId: userId,
      action: AuditActions.AVAILABILITY_OVERRIDE_CREATED,
      targetType: "AvailabilityOverride",
      targetId: created.id,
      metadata: {
        kind: created.kind,
        startAt: created.startAt.toISOString(),
        endAt: created.endAt.toISOString(),
        note: created.note,
      },
    });

    return NextResponse.json(
      ok({
        override: {
          id: created.id,
          startAt: created.startAt.toISOString(),
          endAt: created.endAt.toISOString(),
          kind: created.kind,
          note: created.note,
        },
      })
    )
  } catch {
    return respondUnauthorized()
  }
}
