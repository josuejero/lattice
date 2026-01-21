import { prisma } from "@lattice/db";
import { env } from "@/lib/env";
import { ok } from "@lattice/shared";

/**
 * @openapi
 * /api/db-ping:
 *   get:
 *     summary: Runs a simple SQL query to verify database readiness.
 *     tags:
 *       - Health
 *     responses:
 *       "200":
 *         description: Database responded with the current time.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     now:
 *                       type: string
 *                       format: date-time
 *                     environment:
 *                       type: string
 */
export async function GET() {
  const result = (await prisma.$queryRawUnsafe(
    "select now() as now"
  )) as { now: string }[];
  return Response.json(
    ok({
      now: result?.[0]?.now ?? null,
      environment: env.NODE_ENV,
    })
  );
}
