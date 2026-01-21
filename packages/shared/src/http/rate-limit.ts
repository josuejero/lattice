import { fail } from "./envelope";
import { ErrorCodes } from "./error-codes";
import { getRedisClient } from "../redis/client";

type PolicyConfig = {
  limit: number;
  windowSeconds: number;
};

export const RateLimitPolicies = {
  auth: { limit: 10, windowSeconds: 60 },
  suggestions: { limit: 30, windowSeconds: 60 },
  sync: { limit: 6, windowSeconds: 3600 },
  membership: { limit: 20, windowSeconds: 3600 },
  // add more scopes here as needed
} as const;

export type RateLimitScope = keyof typeof RateLimitPolicies;

const KEY_PREFIX = "rl";

function sanitizeSegment(segment: string | number) {
  return encodeURIComponent(String(segment));
}

export function buildRateLimitKey(scope: RateLimitScope, segments: Array<string | number>) {
  const parts = [KEY_PREFIX, scope, ...segments.map(sanitizeSegment)];
  return parts.join(":");
}

const IP_HEADER_PRIORITY = [
  "x-forwarded-for",
  "x-real-ip",
  "cf-connecting-ip",
  "true-client-ip",
  "fastly-client-ip",
  "x-cluster-client-ip",
];

function parseForwardedHeader(value: string) {
  const match = value.match(/for=("[^"]+"|[^;,\s]+)/i);
  if (!match || !match[1]) return "";
  return match[1].replace(/^"|"$/g, "");
}

export function getRequestIp(req: Request) {
  for (const header of IP_HEADER_PRIORITY) {
    const value = req.headers.get(header);
    if (!value) continue;
    const rawIp = value.split(",")[0];
    if (!rawIp) continue;
    const ip = rawIp.trim();
    if (ip) return ip;
  }

  const forwarded = req.headers.get("forwarded");
  if (forwarded) {
    const parsed = parseForwardedHeader(forwarded);
    if (parsed) return parsed;
  }

  return "unknown";
}

export type RateLimitResult =
  | { allowed: true }
  | {
      allowed: false;
      response: ReturnType<typeof fail>;
      retryAfterSeconds: number;
      policy: PolicyConfig;
    };

export async function enforceRateLimit(scope: RateLimitScope, key: string): Promise<RateLimitResult> {
  const policy = RateLimitPolicies[scope];

  const redisClient = await getRedisClient().catch(() => null);
  if (!redisClient) {
    return { allowed: true };
  }

  try {
    await redisClient.set(key, "0", { NX: true, EX: policy.windowSeconds });
    const count = await redisClient.incr(key);
    let ttl = await redisClient.ttl(key);

    if (ttl < 0) {
      await redisClient.expire(key, policy.windowSeconds);
      ttl = policy.windowSeconds;
    }

    if (count > policy.limit) {
      const retryAfterSeconds = Math.max(ttl, 0);

      return {
        allowed: false,
        response: fail(
          ErrorCodes.RATE_LIMITED,
          "rate_limit_exceeded",
          {
            scope,
            limit: policy.limit,
            windowSeconds: policy.windowSeconds,
            retryAfterSeconds,
          }
        ),
        retryAfterSeconds,
        policy,
      };
    }

    return { allowed: true };
  } catch (error) {
    console.warn("[rate-limit] failed to enforce limit", error);
    return { allowed: true };
  }
}

export function buildRetryAfterHeader(retryAfterSeconds: number) {
  const value = Math.max(Math.ceil(retryAfterSeconds), 1);
  return { "Retry-After": value.toString() };
}
