import { NextResponse } from "next/server";
import crypto from "crypto";
import { google } from "googleapis";

import { env } from "@/lib/env";
import { requireOrgAccess } from "@/lib/guards";
import { setOauthCookie, createPkcePair } from "@/lib/google/oauth";
import { getGcalScopes } from "@/lib/google/calendar";

export const runtime = "nodejs";

/**
 * @openapi
 * /api/orgs/{orgId}/integrations/google/start:
 *   parameters:
 *     - name: orgId
 *       in: path
 *       required: true
 *       schema:
 *         type: string
 *   get:
 *     summary: Starts the Google Calendar OAuth flow for an organization.
 *     tags:
 *       - Integrations
 *     responses:
 *       "302":
 *         description: Redirects the browser to Google's consent screen.
 *       "401":
 *         description: Unauthorized.
 */
export async function GET(_: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const access = await requireOrgAccess(orgId);
  if (!access.ok) return access.response;

  const state = crypto.randomBytes(24).toString("base64url");
  const { verifier, challenge } = createPkcePair();

  await setOauthCookie({
    state,
    verifier,
    orgId,
    userId: access.membership.userId,
    createdAt: Date.now(),
  });

  const scope = getGcalScopes().join(" ");

  const oauth2 = new google.auth.OAuth2(env.GCAL_CLIENT_ID, env.GCAL_CLIENT_SECRET, env.GCAL_REDIRECT_URI);

  const url = oauth2.generateAuthUrl({
    access_type: "offline",
    include_granted_scopes: true,
    scope,
    prompt: "consent",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });

  return NextResponse.redirect(url);
}
