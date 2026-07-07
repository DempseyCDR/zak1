import { loadEnv } from "@/server/lib/loadEnv";

// Load .env for the test process before any module reads env (the db client resolves DATABASE_URL at
// import time). Works on any Node version; warns instead of silently continuing if it fails.
try {
  loadEnv(".env");
} catch (err) {
  console.warn(`[tests/setup] could not load .env: ${(err as Error).message}`);
}
