import { ok } from "@lattice/shared";

/**
 * @openapi
 * /api/health:
 *   get:
 *     summary: Returns a lightweight success response when the app is healthy.
 *     tags:
 *       - Health
 *     responses:
 *       "200":
 *         description: Health check succeeded.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   description: Empty envelope used for health checks.
 */
export async function GET() {
  return Response.json(ok({}));
}
