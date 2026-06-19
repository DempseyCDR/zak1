import pino from "pino";
import { getEnv } from "@/server/validation/env";

/**
 * Structured logger (Constitution Principle IV). JSON output; no console.log in
 * production paths. Import this everywhere instead of console.
 */
export const logger = pino({
  level: (() => {
    try {
      return getEnv().LOG_LEVEL;
    } catch {
      return "info";
    }
  })(),
});

export type Logger = typeof logger;
