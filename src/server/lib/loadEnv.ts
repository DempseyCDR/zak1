import { readFileSync } from "node:fs";

/**
 * Load a .env file into process.env for CLI/test entrypoints.
 *
 * Prefers Node's built-in `process.loadEnvFile` (Node ≥20.6). On older runtimes — or any environment
 * where it is unavailable — it falls back to a minimal parser so tooling does not silently depend on
 * ambient environment variables. Never overrides variables already present in the environment
 * (so real/CI-provided values win).
 */
export function loadEnv(path = ".env"): void {
  if (typeof process.loadEnvFile === "function") {
    process.loadEnvFile(path);
    return;
  }
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (/^\s*(#|$)/.test(line)) continue; // skip blanks and comments
    const eq = line.indexOf("="); // split on the first '=' only (values may contain '=')
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
