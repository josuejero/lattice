import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@lattice/db";
import { logAudit, AuditActions } from "@lattice/shared";
import { env } from "@/lib/env";
import { readOauthCookie, clearOauthCookie } from "@/lib/google/oauth";
import { encryptString } from "@/lib/crypto/secretbox";
import { getGcalScopes } from "@/lib/google/calendar";

export const runtime = "nodejs";

/**
 * @openapi
 * /api/integrations/google/callback:
 *   get:
 *     summary: Handles the Google OAuth callback and persists calendar credentials.
 *     tags:
 *       - Integrations
 *     parameters:
 *       - name: code
 *         in: query
 *         schema:
 *           type: string
 *       - name: state
 *         in: query
 *         schema:
 *           type: string
 *       - name: error
 *         in: query
 *         schema:
 *           type: string
 *     responses:
 *       "302":
 *         description: Redirects back to the integrations page with a result flag.
 */
async function exchangeToken(args: { code: string; codeVerifier: string }) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: args.code,
      client_id: env.GCAL_CLIENT_ID,
      client_secret: env.GCAL_CLIENT_SECRET,
      redirect_uri: env.GCAL_REDIRECT_URI,
      grant_type: "authorization_code",
      code_verifier: args.codeVerifier,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`token_exchange_failed: ${JSON.stringify(json)}`);
  return json as { refresh_token?: string; scope?: string };
}

export async function GET(req: Request) {
  const session = await auth();
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const cookie = await readOauthCookie();
  await clearOauthCookie();

  if (error || !code || !state || !cookie) return NextResponse.redirect(new URL("/integrations?gcal=error", url.origin));

  const expectedState = cookie["state"];
  const verifier = cookie["verifier"];
  const userId = cookie["userId"];

  if (
    typeof expectedState !== "string" ||
    typeof verifier !== "string" ||
    typeof userId !== "string" ||
    state !== expectedState ||
    !session?.user?.id ||
    session.user.id !== userId
  ) {
    return NextResponse.redirect(new URL("/integrations?gcal=error", url.origin));
  }

  const token = await exchangeToken({ code, codeVerifier: verifier });
  if (!token.refresh_token) return NextResponse.redirect(new URL("/integrations?gcal=no_refresh_token", url.origin));

  const defaultScopes = getGcalScopes().join(" ");
  const scopes = token.scope ?? defaultScopes;

  const connection = await prisma.calendarConnection.upsert({
    where: { userId_provider: { userId, provider: "GOOGLE" } },
    update: {
      scopes,
      encryptedRefreshToken: encryptString(token.refresh_token),
      status: "ACTIVE",
    },
    create: {
      userId,
      provider: "GOOGLE",
      scopes,
      encryptedRefreshToken: encryptString(token.refresh_token),
      status: "ACTIVE",
    },
    select: { id: true },
  });

  const orgIdFromCookie = typeof cookie["orgId"] === "string" ? cookie["orgId"] : null;
  if (orgIdFromCookie) {
    await logAudit({
      orgId: orgIdFromCookie,
      actorUserId: userId,
      action: AuditActions.CALENDAR_CONNECTED,
      targetType: "CalendarConnection",
      targetId: connection.id,
      metadata: { provider: "GOOGLE", scopes },
    });
  }

  return NextResponse.redirect(new URL("/integrations?gcal=connected", url.origin));
}
