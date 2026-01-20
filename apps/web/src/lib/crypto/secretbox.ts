import crypto from "crypto";
import { env } from "@/lib/env";

function key(): Buffer {
  const raw = env.TOKEN_ENC_KEY;
  if (!raw) throw new Error("TOKEN_ENC_KEY is required for calendar integration");
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) throw new Error("TOKEN_ENC_KEY must decode to 32 bytes");
  return buf;
}

export function encryptString(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${ciphertext.toString("base64url")}`;
}

export function decryptString(payload: string): string {
  const [v, ivB64, tagB64, ctB64] = payload.split(".");
  if (v !== "v1" || !ivB64 || !tagB64 || !ctB64) throw new Error("Bad ciphertext");
  const iv = Buffer.from(ivB64, "base64url");
  const tag = Buffer.from(tagB64, "base64url");
  const ct = Buffer.from(ctB64, "base64url");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
