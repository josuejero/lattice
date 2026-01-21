import { createHash } from "crypto";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime";

import { prisma } from "@lattice/db";

const IDEMPOTENCY_KEY_TTL_MS = 1000 * 60 * 15; // 15 minutes

type IdempotencyParams = {
  orgId: string;
  endpoint: string;
  key?: string | null;
  requestHash: string;
};

type IdempotencyResponse =
  | { type: "none" }
  | { type: "conflict" }
  | { type: "response"; response: { status: number; body: unknown } }
  | { type: "incomplete" };

export async function getIdempotencyResponse(params: IdempotencyParams): Promise<IdempotencyResponse> {
  const normalizedKey = normalizeKey(params.key);
  if (!normalizedKey) {
    return { type: "none" };
  }

  const entry = await prisma.idempotencyKey.findUnique({
    where: {
      orgId_endpoint_key: {
        orgId: params.orgId,
        endpoint: params.endpoint,
        key: normalizedKey,
      },
    },
  });

  if (!entry) {
    return { type: "none" };
  }

  if (entry.requestHash !== params.requestHash) {
    return { type: "conflict" };
  }

  if (entry.responseStatus != null) {
    return {
      type: "response",
      response: {
        status: entry.responseStatus,
        body: entry.responseBody,
      },
    };
  }

  return { type: "incomplete" };
}

export async function saveIdempotencyResponse({
  orgId,
  endpoint,
  key,
  requestHash,
  responseStatus,
  responseBody,
}: IdempotencyParams & { responseStatus: number; responseBody: unknown }) {
  const normalizedKey = normalizeKey(key);
  if (!normalizedKey) {
    return;
  }

  try {
    await prisma.idempotencyKey.create({
      data: {
        orgId,
        endpoint,
        key: normalizedKey,
        requestHash,
        responseStatus,
        responseBody,
        expiresAt: new Date(Date.now() + IDEMPOTENCY_KEY_TTL_MS),
      },
    });
  } catch (error: unknown) {
    if (error instanceof PrismaClientKnownRequestError && error.code === "P2002") {
      // Another process already stored the response.
      return;
    }
    throw error;
  }
}

export function computeIdempotencyHash(payload: unknown) {
  const hasher = createHash("sha256");
  hasher.update(stableStringify(payload));
  return hasher.digest("hex");
}

function normalizeKey(key?: string | null) {
  const value = key?.trim();
  return value ? value : null;
}

function stableStringify(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (typeof value === "undefined") {
    return "undefined";
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value.toString();
  }
  if (value instanceof Date) {
    return JSON.stringify(value.toISOString());
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => typeof entryValue !== "undefined")
      .sort(([a], [b]) => a.localeCompare(b));
    const serialized = entries
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
      .join(",");
    return `{${serialized}}`;
  }
  return JSON.stringify(value);
}
