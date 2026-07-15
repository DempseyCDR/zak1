import { z } from "zod";

/**
 * Boundary validation for environment variables (Constitution Principle III).
 * Parsed once and reused; throws at startup if misconfigured.
 */
const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  TEST_DATABASE_URL: z.string().url().optional(),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  // Staff session idle window (feature 015). Defaulted so the suite needs no auth config.
  SESSION_IDLE_TTL_HOURS: z.coerce.number().int().positive().default(8),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment: ${parsed.error.message}`);
  }
  cached = parsed.data;
  return cached;
}

/**
 * Google OAuth configuration (feature 015), parsed separately from `getEnv()` and only when the
 * Google client is actually constructed.
 *
 * Deliberately NOT part of `envSchema`: the test suite never contacts Google (it verifies locally
 * signed ID tokens at the boundary — constitution v1.2.0), so requiring these globally would make
 * every database test depend on credentials it cannot use, and would stop a fresh clone running
 * `pnpm test` at all.
 */
const authEnvSchema = z.object({
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_REDIRECT_URI: z.string().url(),
});

export type AuthEnv = z.infer<typeof authEnvSchema>;

let cachedAuth: AuthEnv | null = null;

export function getAuthEnv(): AuthEnv {
  if (cachedAuth) return cachedAuth;
  const parsed = authEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid Google OAuth environment: ${parsed.error.message}`);
  }
  cachedAuth = parsed.data;
  return cachedAuth;
}

/** The connection string to use for the current process (test DB when running tests). */
export function resolveDatabaseUrl(): string {
  const env = getEnv();
  if (process.env.NODE_ENV === "test" || process.env.VITEST) {
    return env.TEST_DATABASE_URL ?? env.DATABASE_URL;
  }
  return env.DATABASE_URL;
}
