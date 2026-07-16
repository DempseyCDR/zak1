import { db } from "@/server/db/client";
import { errors, ApiError } from "@/server/lib/apiError";
import { recordAudit } from "@/server/lib/audit";
import { withLogging } from "@/server/lib/withLogging";
import { readCookie } from "@/server/auth/cookies";
import { SESSION_COOKIE, readSession, type CurrentStaff } from "@/server/auth/session";
import { loadActor, type Actor } from "@/server/auth/actor";
import { actorCan } from "@/server/auth/can";
import type { Requirement } from "@/server/auth/capabilities";

/**
 * Require a staff session — and, since feature 016, a declared REQUIREMENT — for an API route.
 *
 * Mirrors `withLogging` — and wraps it — so protection is applied uniformly by the same mechanism
 * routes already use, rather than being remembered per handler. `/api/*` is default-deny: every route
 * uses this except `/api/auth/*`, which is how one becomes authenticated in the first place.
 *
 * ## The requirement is layer 1 of two (research R5)
 *
 * This checks the actor holds the capability AT SOME SCOPE — coarse and fast, with no database
 * round-trip for the target. It deliberately does NOT do the scoped check: for many routes the target
 * lives in the request BODY (`POST /api/events` carries `seriesId`), and a body may be read only once,
 * so a target-resolving wrapper would have to buffer and re-inject every request in the app. Layer 2 —
 * `assertScope(actor, capability, target)` — lives in the domain service, where the target is known
 * and where the data actually changes.
 *
 * ## Why `'base'` must be written down
 *
 * 28 of the 41 non-auth routes export a `GET` that FR-015 makes universal — every volunteer reads
 * everything except contact PII. Those declare `requires: 'base'`. They are NOT allowed to simply omit
 * the field: a route that declares nothing is indistinguishable from one where someone FORGOT, which
 * is exactly what the route-inventory guard exists to catch. `'base'` is not a Capability and never
 * enters the catalog — an `event.read` held by every role would be a constant `true` pretending to be
 * a decision.
 */

type AuthedHandler<P extends Record<string, string> = Record<string, string>> = (
  req: Request,
  ctx: { params: Promise<P>; staff: CurrentStaff; actor: Actor },
) => Promise<Response>;

type Options = { requires: Requirement };

export function withAuth<P extends Record<string, string> = Record<string, string>>(
  opts: Options,
  handler: AuthedHandler<P>,
) {
  return withLogging<P>(async (req, ctx) => {
    const staff = await readSession(db, readCookie(req, SESSION_COOKIE));
    // 401 with a uniform body via ApiError; says nothing about why (no session vs. withdrawn access).
    if (!staff) throw errors.unauthenticated();

    const actor = await loadActor(db, staff);

    try {
      // 'base' = any authenticated volunteer (FR-015): no catalog lookup, allow. The check is that the
      // route SAID so. This is layer 1 (research R5).
      if (opts.requires !== "base" && !actorCan(actor, opts.requires)) {
        throw errors.unauthorized(opts.requires);
      }
      return await handler(req, { ...ctx, staff, actor });
    } catch (e) {
      // Audit EVERY refusal, from layer 1 (above) OR layer 2 (assertScope inside the service), at this
      // one point — actor and db are both in scope here (FR-026b). It is one row per refused request.
      if (e instanceof ApiError && (e.code === "UNAUTHORIZED" || e.code === "FIELD_NOT_PERMITTED")) {
        await recordAudit(db, {
          kind: "authz.refused",
          actorContactId: staff.contactId,
          details: { capability: e.detail ?? null, code: e.code },
        });
      }
      throw e;
    }
  });
}
