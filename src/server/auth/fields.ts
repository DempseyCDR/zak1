import type { Actor } from "@/server/auth/actor";
import type { Capability } from "@/server/auth/capabilities";
import { actorCan, type Target } from "@/server/auth/can";
import { errors } from "@/server/lib/apiError";

/**
 * Field-level write authority (feature 016, US3; research R6).
 *
 * Some records are written by several roles for different reasons, and the split runs THROUGH the
 * record: a Webmaster owns an event's public description while the Booker owns its venue; the FS owns a
 * door record's money while check-in feeds its comp counts. Route-level authorization cannot express
 * that — it is one requirement per route — so this is the second half.
 *
 * A field map says which capability each field needs. The route requirement is the WEAKER capability
 * (the one every writer of the record holds), so both roles pass layer 1; this refuses the fields a
 * given actor does not own.
 */
export type FieldMap = Record<string, Capability>;

/**
 * Refuse the whole write if it touches any field the actor may not write (FR-022).
 *
 * Two deliberate choices:
 *
 * - **Key PRESENCE, not value change.** A submission carrying `venueId` is an attempt to write it, even
 *   if the value is unchanged — treating "unchanged" as permitted would make authorization depend on
 *   current data, and would let a forbidden field ride along whenever it happened to match. `undefined`
 *   means absent (an unset Zod-optional); `null` is a real value (a clear).
 *
 * - **Throw, never strip.** Call this BEFORE any write, so a mixed submission is refused with nothing
 *   applied. Zod's instinct — silently drop unknown keys and carry on — is the exact failure FR-022
 *   forbids: a Webmaster who submits a venue change must be told, not quietly ignored.
 *
 * Fields absent from the map carry no field-level restriction beyond the route requirement.
 */
export function assertFields(
  actor: Actor | undefined,
  fieldMap: FieldMap,
  input: Record<string, unknown>,
  target?: Target,
): void {
  if (!actor) return;
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue; // not being written
    const capability = fieldMap[key];
    if (!capability) continue; // no field-level rule for this key
    if (!actorCan(actor, capability, target)) throw errors.fieldNotPermitted(key);
  }
}
