/**
 * Minimal cookie helpers for the auth routes (feature 015).
 *
 * Read from the `Request` rather than `next/headers` so route handlers stay directly testable with
 * the existing `tests/integration/helpers/http.ts` harness — the same way every other route in this
 * codebase is tested.
 */

export const STATE_COOKIE = "zak1_oauth_state";
export const VERIFIER_COOKIE = "zak1_oauth_verifier";
export const NEXT_COOKIE = "zak1_oauth_next";

export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return undefined;
}

export type CookieOptions = { maxAgeSeconds?: number; expires?: Date };

/** Always httpOnly + SameSite=Lax; Secure outside development. */
export function serializeCookie(name: string, value: string, opts: CookieOptions = {}): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    // Lax (not Strict): the cookie must survive Google's cross-site redirect back to us.
    "SameSite=Lax",
  ];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  if (opts.maxAgeSeconds !== undefined) parts.push(`Max-Age=${opts.maxAgeSeconds}`);
  if (opts.expires) parts.push(`Expires=${opts.expires.toUTCString()}`);
  return parts.join("; ");
}

export function clearCookie(name: string): string {
  return serializeCookie(name, "", { maxAgeSeconds: 0 });
}
