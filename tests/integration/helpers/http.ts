import { testSessionToken } from "./db";
import { SESSION_COOKIE } from "@/server/auth/session";

const BASE = "http://localhost";

/**
 * Feature 015 made /api/* default-deny, so route tests must be authenticated. The standing staff
 * session seeded by resetDb() is attached here, keeping pre-auth test files unchanged.
 * Tests that assert on UNauthenticated behaviour build their own Request instead.
 */
function authCookie(): string {
  return `${SESSION_COOKIE}=${encodeURIComponent(testSessionToken())}`;
}

/**
 * A request AS a specific actor (feature 016) — pair with `makeActor`.
 *
 * The standing session in `jsonReq` is a club-wide super_user, so it can do anything: authorization
 * tests must act as their own scoped actor or they assert nothing.
 */
export function jsonReqAs(token: string, method: string, path: string, body?: unknown): Request {
  return new Request(`${BASE}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      cookie: `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function jsonReq(method: string, path: string, body?: unknown): Request {
  return new Request(`${BASE}${path}`, {
    method,
    headers: { "content-type": "application/json", cookie: authCookie() },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** Build the route-handler context with an async params bag. */
export function ctx<P extends Record<string, string> = Record<string, string>>(
  // Escape hatch: empty-params default for no-segment routes; cast is safe because
  // such handlers never read params. Test-only helper.
  params: P = {} as P,
) {
  return { params: Promise.resolve(params) };
}
