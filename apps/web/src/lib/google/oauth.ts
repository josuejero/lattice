import crypto from "crypto";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

const COOKIE = "lattice_gcal_oauth";

const b64url = (buf: Buffer) => buf.toString("base64url");
const sign = (json: string) => crypto.createHmac("sha256", env.AUTH_SECRET).update(json).digest("base64url");

export function createPkcePair() {
  const verifier = b64url(crypto.randomBytes(32));
  const challenge = b64url(crypto.createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

export async function setOauthCookie(payload: Record<string, unknown>) {
  const json = JSON.stringify(payload);
  const value = `${b64url(Buffer.from(json))}.${sign(json)}`;
  ;(await cookies()).set(COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60,
  });
}

export async function readOauthCookie() {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [payloadB64, sig] = raw.split(".");
  if (!payloadB64 || !sig) return null;
  const json = Buffer.from(payloadB64, "base64url").toString("utf8");
  if (sign(json) !== sig) return null;
  return JSON.parse(json) as Record<string, unknown>;
}

export async function clearOauthCookie() {
  ;(await cookies()).set(COOKIE, "", { path: "/", maxAge: 0 });
}
