import { google } from "googleapis";
import crypto from "crypto";
import { env } from "@/lib/env";
import { decryptString } from "@/lib/crypto/secretbox";

export const GCAL_READ_SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"] as const;
export const GCAL_WRITE_SCOPES = [
  ...GCAL_READ_SCOPES,
  "https://www.googleapis.com/auth/calendar.events",
] as const;

export function getGcalScopes() {
  return env.GCAL_WRITEBACK_ENABLED ? GCAL_WRITE_SCOPES : GCAL_READ_SCOPES;
}
export const MERGED_SOURCE_HASH = crypto.createHash("sha256").update("google:merged").digest("hex");

function assertConfig() {
  if (!env.GCAL_CLIENT_ID || !env.GCAL_CLIENT_SECRET || !env.GCAL_REDIRECT_URI) {
    throw new Error("GCAL_CLIENT_ID/SECRET/REDIRECT_URI are required for calendar integration");
  }
}

export function calendarIdHash(calendarId: string) {
  return crypto.createHash("sha256").update(calendarId + env.AUTH_SECRET).digest("hex");
}

export function blockHash(args: { orgId: string; userId: string; sourceHash: string; startISO: string; endISO: string }) {
  return crypto
    .createHash("sha256")
    .update(`${args.userId}|${args.orgId}|${args.sourceHash}|${args.startISO}|${args.endISO}`)
    .digest("hex");
}

function oauth(refreshTokenCiphertext: string) {
  assertConfig();
  const refreshToken = decryptString(refreshTokenCiphertext);
  const client = new google.auth.OAuth2(env.GCAL_CLIENT_ID, env.GCAL_CLIENT_SECRET, env.GCAL_REDIRECT_URI);
  client.setCredentials({ refresh_token: refreshToken });
  return client;
}

export async function listCalendars(refreshTokenCiphertext: string) {
  const auth = oauth(refreshTokenCiphertext);
  const cal = google.calendar({ version: "v3", auth });

  const out: Array<{ id: string; summary?: string; primary?: boolean; accessRole?: string }> = [];
  let pageToken: string | undefined;

  do {
    const res = await cal.calendarList.list({
      pageToken,
      maxResults: 250,
      fields: "items(id,summary,primary,accessRole),nextPageToken",
    });
    for (const item of res.data.items ?? []) {
      if (!item.id) continue;
      out.push({
        id: item.id,
        summary: item.summary ?? undefined,
        primary: item.primary ?? undefined,
        accessRole: item.accessRole ?? undefined,
      });
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  return out;
}

export async function freeBusy(args: {
  refreshTokenCiphertext: string;
  calendarIds: string[];
  timeMinISO: string;
  timeMaxISO: string;
  timeZone?: string;
}) {
  const auth = oauth(args.refreshTokenCiphertext);
  const cal = google.calendar({ version: "v3", auth });

  const res = await cal.freebusy.query({
    requestBody: {
      timeMin: args.timeMinISO,
      timeMax: args.timeMaxISO,
      timeZone: args.timeZone,
      items: args.calendarIds.map((id) => ({ id })),
    },
  });

  return res.data.calendars ?? {};
}

export function mergeUtcIntervals(intervals: Array<{ startUtc: Date; endUtc: Date }>) {
  const sorted = intervals
    .filter((i) => i.startUtc < i.endUtc)
    .sort((a, b) => a.startUtc.getTime() - b.startUtc.getTime());
  const merged: Array<{ startUtc: Date; endUtc: Date }> = [];
  for (const cur of sorted) {
    const last = merged[merged.length - 1];
    if (!last) {
      merged.push(cur);
      continue;
    }
    if (cur.startUtc.getTime() <= last.endUtc.getTime()) {
      last.endUtc = new Date(Math.max(last.endUtc.getTime(), cur.endUtc.getTime()));
    } else merged.push(cur);
  }
  return merged;
}

export async function createGoogleCalendarEvent(args: {
  refreshTokenCiphertext: string;
  calendarId: string;
  summary: string;
  description?: string;
  startISO: string;
  endISO: string;
  timeZone: string;
  attendees?: Array<{ email: string }>;
  sendUpdates?: "all" | "externalOnly" | "none";
}) {
  const auth = oauth(args.refreshTokenCiphertext);
  const cal = google.calendar({ version: "v3", auth });

  const res = await cal.events.insert({
    calendarId: args.calendarId,
    sendUpdates: args.sendUpdates ?? "none",
    requestBody: {
      summary: args.summary,
      description: args.description,
      start: { dateTime: args.startISO, timeZone: args.timeZone },
      end: { dateTime: args.endISO, timeZone: args.timeZone },
      attendees: args.attendees,
    },
  });

  return res.data;
}
