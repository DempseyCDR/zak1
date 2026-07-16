import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/server/db/client";
import { SESSION_COOKIE, readSession, type CurrentStaff } from "@/server/auth/session";
import { loadActor, type Actor } from "@/server/auth/actor";

/**
 * The authorization seam (feature 015, FR-005) — what P3-2 will build on.
 *
 * This answers ONLY "who is signed in?", never "may they do this?". `CurrentStaff` deliberately
 * carries no roles, scopes, or permissions: the role × capability × scope model in
 * `docs/use-cases.md` is the next feature's job, and it will layer around this rather than replace it.
 *
 * For server components and route-group layouts. API handlers use `withAuth` instead, because they
 * read the session from the `Request` rather than from `next/headers`.
 */

export type { CurrentStaff };

/** The signed-in staff member, or null. Validates expiry and re-checks is_volunteer live (FR-011). */
export async function getCurrentStaff(): Promise<CurrentStaff | null> {
  const store = await cookies();
  return readSession(db, store.get(SESSION_COOKIE)?.value);
}

/**
 * Require a signed-in staff member, or redirect to sign-in.
 *
 * Call once per protected route group's `layout.tsx` — that covers every page in the group, so a new
 * page cannot be forgotten.
 */
export async function requireStaff(next?: string): Promise<CurrentStaff> {
  const staff = await getCurrentStaff();
  if (!staff) {
    redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  }
  return staff;
}

/**
 * Require a signed-in staff member AND load their grants — the authorization view (feature 016).
 *
 * For server components (layouts, pages) that need capabilities, e.g. to derive nav. API handlers get
 * the `Actor` injected by `withAuth` instead. Grants are loaded live per request (FR-014), no caching.
 */
export async function requireActor(next?: string): Promise<Actor> {
  const staff = await requireStaff(next);
  return loadActor(db, staff);
}
