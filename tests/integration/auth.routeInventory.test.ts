import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * FR-004 / SC-002: `/api/*` is default-deny.
 *
 * A source-level invariant rather than a per-route functional test, and deliberately so: it is
 * SELF-MAINTAINING. Add a route without `withAuth` and this fails immediately — no one has to
 * remember to extend a list. Enumerating ~44 paths by hand would rot the first time someone added
 * the 45th.
 *
 * `/api/auth/*` is the sole exemption: those routes are how one becomes authenticated, so requiring
 * a session for them would be a deadlock.
 */

const API_ROOT = join(process.cwd(), "src/app/api");
const AUTH_PREFIX = join(API_ROOT, "auth");
const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;

function findRouteFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...findRouteFiles(full));
    else if (entry === "route.ts") out.push(full);
  }
  return out;
}

/** Every exported HTTP method and the wrapper it is built from. */
function exportedMethods(source: string): { method: string; wrapper: string }[] {
  const re = new RegExp(
    `export\\s+const\\s+(${HTTP_METHODS.join("|")})\\s*(?::[^=]+)?=\\s*([A-Za-z_$][\\w$]*)`,
    "g",
  );
  const found: { method: string; wrapper: string }[] = [];
  for (const m of source.matchAll(re)) found.push({ method: m[1]!, wrapper: m[2]! });
  return found;
}

describe("API route inventory: default-deny (FR-004, SC-002)", () => {
  const all = findRouteFiles(API_ROOT);
  const protectedRoutes = all.filter((f) => !f.startsWith(AUTH_PREFIX + "/"));
  const authRoutes = all.filter((f) => f.startsWith(AUTH_PREFIX + "/"));

  it("finds the API surface (guards against the walker silently matching nothing)", () => {
    expect(all.length).toBeGreaterThan(30);
    expect(authRoutes.length).toBeGreaterThan(0);
  });

  it("every non-auth route exports at least one HTTP method", () => {
    for (const file of protectedRoutes) {
      const methods = exportedMethods(readFileSync(file, "utf8"));
      expect(methods.length, `${relative(process.cwd(), file)} exports no HTTP method`).toBeGreaterThan(0);
    }
  });

  it("EVERY exported method of EVERY non-auth route is wrapped in withAuth", () => {
    const unprotected: string[] = [];
    for (const file of protectedRoutes) {
      for (const { method, wrapper } of exportedMethods(readFileSync(file, "utf8"))) {
        if (wrapper !== "withAuth") {
          unprotected.push(`${relative(process.cwd(), file)} → ${method} = ${wrapper}(...)`);
        }
      }
    }
    expect(unprotected, `unprotected API routes:\n${unprotected.join("\n")}`).toEqual([]);
  });

  it("auth routes stay PUBLIC — requiring a session there would deadlock sign-in", () => {
    for (const file of authRoutes) {
      for (const { method, wrapper } of exportedMethods(readFileSync(file, "utf8"))) {
        expect(wrapper, `${relative(process.cwd(), file)} → ${method} must not require auth`).not.toBe(
          "withAuth",
        );
      }
    }
  });
});
