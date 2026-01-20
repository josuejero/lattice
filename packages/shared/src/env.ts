import { z } from "zod";

const boolishString = z
  .string()
  .optional()
  .default("0")
  .transform((value) => {
    const normalized = value?.toLowerCase() ?? "";
    return normalized === "1" || normalized === "true";
  });

// NOTE: keep Phase 0 minimal. Expand as you add features.
export const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().optional(),
  AUTH_SECRET: z.string().min(10),
  AUTH_GOOGLE_ID: z.string().optional().or(z.literal("")),
  AUTH_GOOGLE_SECRET: z.string().optional().or(z.literal("")),
  RESEND_API_KEY: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  GCAL_CLIENT_ID: z.string().optional().or(z.literal("")).default(""),
  GCAL_CLIENT_SECRET: z.string().optional().or(z.literal("")).default(""),
  GCAL_REDIRECT_URI: z.string().optional().or(z.literal("")).default(""),
  TOKEN_ENC_KEY: z.string().optional().or(z.literal("")).default(""),
  SUGGESTIONS_ENABLED: boolishString,
  EVENTS_ENABLED: boolishString,
  GCAL_WRITEBACK_ENABLED: boolishString,
});

export type Env = z.infer<typeof EnvSchema>;

export function parseEnv(raw: Record<string, string | undefined>): Env {
  return EnvSchema.parse(raw);
}
