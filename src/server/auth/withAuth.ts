import { db } from "@/server/db/client";
import { errors } from "@/server/lib/apiError";
import { withLogging } from "@/server/lib/withLogging";
import { readCookie } from "@/server/auth/cookies";
import { SESSION_COOKIE, readSession, type CurrentStaff } from "@/server/auth/session";

/**
 * Require a staff session for an API route (feature 015, FR-004).
 *
 * Mirrors `withLogging` — and wraps it — so protection is applied uniformly by the same mechanism
 * routes already use, rather than being remembered per handler. `/api/*` is default-deny: every route
 * uses this except `/api/auth/*`, which is how one becomes authenticated in the first place.
 *
 * Like `getCurrentStaff`, this answers only "who is signed in?" — the injected `staff` carries no
 * roles. Authorization is P3-2.
 */

type AuthedHandler<P extends Record<string, string> = Record<string, string>> = (
  req: Request,
  ctx: { params: Promise<P>; staff: CurrentStaff },
) => Promise<Response>;

export function withAuth<P extends Record<string, string> = Record<string, string>>(
  handler: AuthedHandler<P>,
) {
  return withLogging<P>(async (req, ctx) => {
    const staff = await readSession(db, readCookie(req, SESSION_COOKIE));
    // 401 with a uniform body via ApiError; says nothing about why (no session vs. withdrawn access).
    if (!staff) throw errors.unauthenticated();
    return handler(req, { ...ctx, staff });
  });
}
