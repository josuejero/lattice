import { NextRequest, NextResponse } from "next/server";

import {
  buildRateLimitKey,
  buildRetryAfterHeader,
  enforceRateLimit,
  getRequestIp,
} from "@lattice/shared";
import { GET as nextAuthGET, POST as nextAuthPOST } from "@/auth";

/**
 * @openapi
 * /api/auth/{nextAuthPath}:
 *   summary: NextAuth endpoints for authentication flows.
 *   parameters:
 *     - name: nextAuthPath
 *       in: path
 *       required: true
 *       schema:
 *         type: string
 *         description: Catch-all path used by NextAuth for session, sign-in, callbacks, and providers.
 *   get:
 *     summary: Serves provider metadata, session status, and callback redirects.
 *     responses:
 *       "200":
 *         description: NextAuth processed the GET request.
 *   post:
 *     summary: Accepts sign-in, callback, and credential payloads from clients.
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             description: Form encoded payload handled by NextAuth.
 *     responses:
 *       "200":
 *         description: NextAuth processed the POST request.
 */

const RATE_LIMIT_SCOPE = "auth";

async function applyAuthRateLimit(req: NextRequest) {
  const key = buildRateLimitKey(RATE_LIMIT_SCOPE, [getRequestIp(req)]);
  const result = await enforceRateLimit(RATE_LIMIT_SCOPE, key);
  if (result.allowed) {
    return null;
  }

  return NextResponse.json(result.response, {
    status: 429,
    headers: buildRetryAfterHeader(result.retryAfterSeconds),
  });
}

export async function GET(req: NextRequest) {
  const rateLimitResponse = await applyAuthRateLimit(req);
  if (rateLimitResponse) return rateLimitResponse;
  return nextAuthGET(req);
}

export async function POST(req: NextRequest) {
  const rateLimitResponse = await applyAuthRateLimit(req);
  if (rateLimitResponse) return rateLimitResponse;
  return nextAuthPOST(req);
}

export const runtime = "nodejs";
