import { eq } from "drizzle-orm";
import type { DbOrTx } from "@/server/db/client";
import { roleGrants, type Role } from "@/server/db/schema";
import type { CurrentStaff } from "@/server/auth/session";

/**
 * The authorization view of a signed-in person (feature 016).
 *
 * Deliberately WRAPS `CurrentStaff` rather than extending it. Feature 015 wrote that `CurrentStaff`
 * "carries no roles, scopes, or permissions… the role × capability × scope model is the next feature's
 * job, and it will layer around this rather than replace it." This is that layer: `getCurrentStaff()`
 * and `readSession()` stay the answer to "who is signed in?" and nothing else.
 */

/** One role at one scope. Both scope ids null = club-wide (data-model.md §3). */
export type Grant = {
  role: Role;
  seriesId: string | null;
  groupId: string | null;
};

export type Actor = {
  staff: CurrentStaff;
  grants: Grant[];
};

/**
 * Load a contact's grants — one indexed query, per request.
 *
 * NOT cached, deliberately. FR-014 requires a revoked grant to be gone on the holder's NEXT request,
 * with no sign-out; a cache is precisely how that stops being true. At this scale (tens of staff) the
 * query is noise next to the session read it sits beside.
 *
 * Eligibility is not re-checked here: `readSession` already joins `contacts.is_volunteer` live, so a
 * cleared volunteer never gets this far. That live join is also why an orphaned grant is unusable
 * rather than dangerous.
 */
export async function loadGrants(db: DbOrTx, contactId: string): Promise<Grant[]> {
  return db
    .select({
      role: roleGrants.role,
      seriesId: roleGrants.seriesId,
      groupId: roleGrants.groupId,
    })
    .from(roleGrants)
    .where(eq(roleGrants.contactId, contactId));
}

/** Build the authorization view for a signed-in staff member. */
export async function loadActor(db: DbOrTx, staff: CurrentStaff): Promise<Actor> {
  return { staff, grants: await loadGrants(db, staff.contactId) };
}
