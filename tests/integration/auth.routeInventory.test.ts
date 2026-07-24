import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { CAPABILITIES } from "@/server/auth/capabilities";
import { apiRouteFiles, exportedMethods } from "@/server/lib/routeInventory";
import { PUBLIC_API_ROUTES } from "@/server/auth/withPublic";

/**
 * FR-004 / SC-002: `/api/*` is default-deny — and, since feature 016, every method DECLARES what it
 * requires (FR-019).
 *
 * A source-level invariant rather than a per-route functional test, and deliberately so: it is
 * SELF-MAINTAINING. Add a route without `withAuth` and this fails immediately — no one has to
 * remember to extend a list. Enumerating ~44 paths by hand would rot the first time someone added
 * the 45th.
 *
 * `/api/auth/*` is the sole exemption: those routes are how one becomes authenticated, so requiring
 * a session for them would be a deadlock.
 */

/** Every capability the catalog knows — the source of truth a declaration must match. */
const KNOWN_CAPABILITIES = new Set<string>(
  Object.values(CAPABILITIES).flatMap((caps) => Object.keys(caps)),
);

const API_ROOT = join(process.cwd(), "src/app/api");
const AUTH_PREFIX = join(API_ROOT, "auth");

/** The `route.ts` file backing an allowlisted public API path (feature 019 US3, research R2). */
function fileForPublicPath(apiPath: string): string {
  return join(API_ROOT, apiPath.replace(/^\/api/, ""), "route.ts");
}
const PUBLIC_FILES = new Set(PUBLIC_API_ROUTES.map(fileForPublicPath));

describe("API route inventory: default-deny (FR-004, SC-002)", () => {
  const all = apiRouteFiles();
  const authRoutes = all.filter((f) => f.startsWith(AUTH_PREFIX + "/"));
  // Non-auth, non-public routes must be withAuth; the enumerated public allowlist is checked separately.
  const protectedRoutes = all.filter(
    (f) => !f.startsWith(AUTH_PREFIX + "/") && !PUBLIC_FILES.has(f),
  );
  const publicRoutes = all.filter((f) => PUBLIC_FILES.has(f));

  it("finds the API surface (guards against the walker silently matching nothing)", () => {
    expect(all.length).toBeGreaterThan(30);
    expect(authRoutes.length).toBeGreaterThan(0);
  });

  it("every non-auth route exports at least one HTTP method", () => {
    for (const file of protectedRoutes) {
      const methods = exportedMethods(readFileSync(file, "utf8"));
      expect(
        methods.length,
        `${relative(process.cwd(), file)} exports no HTTP method`,
      ).toBeGreaterThan(0);
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

  it("EVERY exported method of EVERY non-auth route DECLARES a requirement (FR-019)", () => {
    // The declaration is mandatory rather than omittable — including for the 25 `base` reads that
    // FR-015 makes universal. A route that declared nothing would be indistinguishable from one where
    // someone FORGOT, and "forgot" is exactly what this guard exists to catch. `'base'` written down
    // is a decision; absence is an accident.
    //
    // tsc already rejects a missing `requires` (withAuth takes two arguments). This is the belt to
    // that braces: it survives someone reaching for `as any`, and it names the offender by path.
    const undeclared: string[] = [];
    for (const file of protectedRoutes) {
      for (const { method, requires } of exportedMethods(readFileSync(file, "utf8"))) {
        if (!requires) undeclared.push(`${relative(process.cwd(), file)} → ${method}`);
      }
    }
    expect(undeclared, `routes declaring no requirement:\n${undeclared.join("\n")}`).toEqual([]);
  });

  it("declares only requirements the catalog actually knows (no typos)", () => {
    // A typo'd capability would be a silent DENY at runtime — the route would 403 forever and look
    // like a permissions bug rather than a spelling one.
    const valid = new Set<string>(["base", ...KNOWN_CAPABILITIES]);
    const bogus: string[] = [];
    for (const file of protectedRoutes) {
      for (const { method, requires } of exportedMethods(readFileSync(file, "utf8"))) {
        if (requires && !valid.has(requires)) {
          bogus.push(`${relative(process.cwd(), file)} → ${method} = "${requires}"`);
        }
      }
    }
    expect(bogus, `unknown requirements:\n${bogus.join("\n")}`).toEqual([]);
  });

  // Feature 019 US3 (research R2): the FIRST cracks in default-deny. The allowlist is the architecture —
  // an enumerated set of exactly two routes, each declaring `withPublic` (deliberate publicity), so a
  // third unauthenticated route cannot appear without editing PUBLIC_API_ROUTES and this test noticing.
  it("the public allowlist is EXACTLY the two feature-019 routes", () => {
    expect(PUBLIC_API_ROUTES.length).toBe(2);
    expect(publicRoutes.length).toBe(PUBLIC_API_ROUTES.length);
  });

  it("every allowlisted public route is wrapped in withPublic, never withAuth", () => {
    for (const file of publicRoutes) {
      for (const { method, wrapper } of exportedMethods(readFileSync(file, "utf8"))) {
        expect(wrapper, `${relative(process.cwd(), file)} → ${method} must be withPublic`).toBe(
          "withPublic",
        );
      }
    }
  });

  it("no route OUTSIDE the allowlist uses withPublic (default-deny holds)", () => {
    const leaked: string[] = [];
    for (const file of protectedRoutes) {
      for (const { method, wrapper } of exportedMethods(readFileSync(file, "utf8"))) {
        if (wrapper === "withPublic") leaked.push(`${relative(process.cwd(), file)} → ${method}`);
      }
    }
    expect(leaked, `withPublic used off-allowlist:\n${leaked.join("\n")}`).toEqual([]);
  });

  it("auth routes stay PUBLIC — requiring a session there would deadlock sign-in", () => {
    for (const file of authRoutes) {
      for (const { method, wrapper } of exportedMethods(readFileSync(file, "utf8"))) {
        expect(
          wrapper,
          `${relative(process.cwd(), file)} → ${method} must not require auth`,
        ).not.toBe("withAuth");
      }
    }
  });
});
