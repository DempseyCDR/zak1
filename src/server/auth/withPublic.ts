import { withLogging } from "@/server/lib/withLogging";

/**
 * Feature 019 US3 (research R2): declare a route DELIBERATELY unauthenticated.
 *
 * `/api/*` is default-deny (feature 016): every route is `withAuth`, and `auth.routeInventory.test.ts`
 * enforces exactly that. US3 needs two routes that cannot carry a staff session — a public membership
 * capture form, and a PayPal webhook — so this wrapper exists to make "no auth, on purpose" a DECLARED,
 * greppable, test-asserted fact rather than a forgotten `withAuth`. The guard permits `withPublic` only
 * for an enumerated allowlist (`PUBLIC_API_ROUTES`), so a *third* public route cannot appear unnoticed.
 *
 * It wraps `withLogging` exactly as `withAuth` does, so public routes are logged and error-translated
 * identically; it simply performs no session read and no capability check. Authenticity, where it matters
 * (the webhook), comes from PayPal signature verification inside the handler — never from a session.
 */
export const PUBLIC_API_ROUTES = ["/api/public/membership", "/api/webhooks/paypal"] as const;

type PublicHandler<P extends Record<string, string> = Record<string, string>> = (
  req: Request,
  ctx: { params: Promise<P> },
) => Promise<Response>;

export function withPublic<P extends Record<string, string> = Record<string, string>>(
  handler: PublicHandler<P>,
): PublicHandler<P> {
  return withLogging<P>(handler);
}
