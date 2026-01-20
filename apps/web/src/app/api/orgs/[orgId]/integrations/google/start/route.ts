import { NextResponse } from "next/server";
import crypto from "crypto";
import { google } from "googleapis";

import { env } from "@/lib/env";
import { requireMembership } from "@/lib/guards";
import { setOauthCookie, createPkcePair } from "@/lib/google/oauth";
import { getGcalScopes } from "@/lib/google/calendar";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: { orgId: string } }) {
  const access = await requireMembership(params.orgId);
  if (!access.ok) return NextResponse.json({ error: "not_found" }, { status: access.status });

  const state = crypto.randomBytes(24).toString("base64url");
  const { verifier, challenge } = createPkcePair();

  await setOauthCookie({
    state,
    verifier,
    orgId: params.orgId,
    userId: access.session.user.id,
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
