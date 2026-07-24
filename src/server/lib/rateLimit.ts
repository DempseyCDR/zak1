/**
 * Feature 019 US3: a minimal in-memory, per-key fixed-window rate limiter. Single-tenant, one server, so
 * no shared store is needed (research R2 / contract). Guards the ONLY unauthenticated write in the app —
 * the public membership capture — against flooding. A capture confers nothing on its own, so this is a
 * tidiness/abuse bound, not a security control.
 */
const hits = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || now >= entry.resetAt) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count += 1;
  return true;
}

/** Test seam: clear all counters (so one test's burst does not bleed into the next). */
export function resetRateLimits(): void {
  hits.clear();
}
