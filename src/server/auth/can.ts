import { CAPABILITIES, type Capability } from "@/server/auth/capabilities";
import type { Actor, Grant } from "@/server/auth/actor";
import { errors } from "@/server/lib/apiError";

/**
 * The evaluator (feature 016; contracts §3).
 *
 * Scope is a SET OF FILTERS — series OR group — never a tree walk (FR-007). Group and series are
 * orthogonal axes, so the two checks below are independent branches: that is what lets a group-scoped
 * grant reach an event in a series the holder has no authority over, which is intended.
 *
 * Authority is the additive UNION of grants and there is NO deny rule (FR-004). "Door Attendant ✗
 * gate" is expressed by the Door Attendant's catalog row simply not containing `gate.write` — never by
 * a deny entry. A deny would strip gate access from an FS who also works the door, which
 * use-cases.md §5.2.8 expects to be routine. **Do not add a deny mechanism here.**
 */

/** What a capability is being exercised against. An event resolves to its series and group. */
export type Target = {
  seriesId?: string | null;
  groupId?: string | null;
};

function grantAllows(grant: Grant, capability: Capability, target: Target | undefined): boolean {
  const mode = CAPABILITIES[grant.role][capability];
  if (!mode) return false; // this grant says nothing about this capability
  if (mode === "global") return true; // confers it everywhere, whatever the grant's own scope

  // scoped: club-wide grant (both null) matches any target.
  if (grant.seriesId === null && grant.groupId === null) return true;

  // NO TARGET = an unscoped question ("do you hold this ANYWHERE?"), so there is nothing to filter on
  // and the grant qualifies. This is what `withAuth` asks at layer 1, before the body has been read
  // and the target is knowable. Without it, layer 1 would refuse every scoped grant-holder outright —
  // a Booker-of-ecd would be denied at the door of their own series.
  if (!target) return true;

  if (grant.seriesId !== null) return !!target.seriesId && target.seriesId === grant.seriesId;
  // Group-scoped: matches only within the group. An ungrouped event simply does not match — no error.
  return !!target.groupId && target.groupId === grant.groupId;
}

/**
 * May this actor exercise this capability against this target?
 *
 * Takes the grants rather than the Actor so it stays a pure function of (grants, capability, target)
 * — trivially unit-testable, and with no way to reach for a database mid-decision.
 */
export function can(grants: Grant[], capability: Capability, target?: Target): boolean {
  return grants.some((g) => grantAllows(g, capability, target));
}

/** `can` for a whole Actor. */
export function actorCan(actor: Actor, capability: Capability, target?: Target): boolean {
  return can(actor.grants, capability, target);
}

/**
 * Enforce a capability at the point the target is known — the service layer (research R5).
 *
 * Throws UNAUTHORIZED (403) NAMING the capability. That is deliberate and the opposite of 015's
 * silent 401: under FR-015 this actor could already READ the thing they were refused, so concealment
 * protects nothing and only costs them the ability to understand what happened (FR-026).
 *
 * `actor` is optional so a service can be called WITHOUT an actor — by another service, or a CLI, or
 * a test — and skip the check. Enforcement is opt-in at the call site that has a request behind it.
 * The route wrapper is layer 1's backstop, so an actor-less internal call is not an open door.
 */
export function assertScope(actor: Actor | undefined, capability: Capability, target?: Target): void {
  if (actor && !actorCan(actor, capability, target)) throw errors.unauthorized(capability);
}

/** The scope target of an event: its series and (nullable) group. The canonical resolution. */
export type EventScope = { seriesId: string; groupId: string | null };

/**
 * Assert a capability against an event's scope. The event carries both axes (series AND group), and
 * they are passed as independent filters — never a tree — so a group-scoped grant reaches it even in a
 * series the holder has no authority over (FR-007).
 */
export function assertEventScope(
  actor: Actor | undefined,
  capability: Capability,
  event: EventScope,
): void {
  assertScope(actor, capability, { seriesId: event.seriesId, groupId: event.groupId });
}
