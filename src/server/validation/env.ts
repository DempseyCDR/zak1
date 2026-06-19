import { z } from "zod";

/**
 * Boundary validation for environment variables (Constitution Principle III).
 * Parsed once and reused; throws at startup if misconfigured.
 */
const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  TEST_DATABASE_URL: z.string().url().optional(),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
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

/** The connection string to use for the current process (test DB when running tests). */
export function resolveDatabaseUrl(): string {
  const env = getEnv();
  if (process.env.NODE_ENV === "test" || process.env.VITEST) {
    return env.TEST_DATABASE_URL ?? env.DATABASE_URL;
  }
  return env.DATABASE_URL;
}
