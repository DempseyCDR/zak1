import type { DbOrTx } from "@/server/db/client";
import type { Actor } from "@/server/auth/actor";
import { actorCan } from "@/server/auth/can";
import { recordAudit } from "@/server/lib/audit";

/**
 * Contact PII read + disclosure audit (feature 016, US4).
 *
 * The read rule is one line (FR-015/FR-016): every authenticated volunteer reads everything EXCEPT
 * contact email addresses and phone numbers. Those need a grant — `contact.pii.read`, which rides on
 * the roles whose jobs require it (Door Attendant matching a dancer, VP/MLM/Secretary for exports,
 * Booker for performer contact, Treasurer/FS for membership; FR-016a). Only the bare Organizer base is
 * excluded — precisely the lapsed short-term volunteer the rule targets.
 *
 * ⚠️ `requires: 'base'` on a route is NOT "no PII rules apply". `GET /api/contacts/[id]` is base — any
 * volunteer may look a contact up — but its PII is still projected away here unless the actor holds the
 * capability. Route requirement and field-level projection answer different questions.
 */

/** May this actor read contact PII at all? */
export function canReadPii(actor: Actor | undefined): boolean {
  return !!actor && actorCan(actor, "contact.pii.read");
}

/**
 * Record ONE audit row for a PII-disclosing request (FR-017b).
 *
 * Per REQUEST, with a count — never per contact. Check-in search fires per keystroke and returns up to
 * 20 contacts; a per-contact row would make this the largest table in the database and answer nothing
 * SC-014 asks. `count` is how many contacts' PII the request disclosed; 0 disclosures write nothing, so
 * a base volunteer's PII-free read leaves no noise in the trail.
 */
export async function recordPiiDisclosure(
  db: DbOrTx,
  actor: Actor,
  surface: string,
  count: number,
): Promise<void> {
  if (count <= 0) return;
  await recordAudit(db, {
    kind: "pii.disclosed",
    actorContactId: actor.staff.contactId,
    details: { surface, count },
  });
}

/**
 * A contact carrying the PII fields this projection protects.
 *
 * ⚠️ This is a DENYLIST: `projectContact` spreads the contact and knocks out the fields named below, so
 * any NEW field carrying an address or phone number is exposed by default and must be added here.
 * Feature 067 added `messageRecipient`, whose `address` is another contact's email — the very thing
 * `emails: []` exists to withhold (feature 067, FR-016).
 */
type WithPii = {
  phone: string | null;
  emails: unknown[];
  messageRecipient?: { address: string | null } | null;
};

/**
 * Strip PII from a contact unless the actor may read it (FR-016).
 *
 * Returns the same shape with `phone` nulled and `emails` emptied when denied, so clients keep a stable
 * contract — the fields are absent-of-value, not absent-of-key. The caller is responsible for the
 * disclosure audit when it returns unprojected PII (`recordPiiDisclosure`).
 *
 * Feature 067: the shared address is nulled the same way, but the OWNER'S NAME is kept — a base
 * volunteer still sees "reached via David Jones", which is comprehensible without disclosing anything
 * they could not already read. `sharedWith` needs no redaction: ids and display names only.
 */
export function projectContact<T extends WithPii>(actor: Actor | undefined, contact: T): T {
  if (canReadPii(actor)) return contact;
  return {
    ...contact,
    phone: null,
    emails: [],
    ...(contact.messageRecipient
      ? { messageRecipient: { ...contact.messageRecipient, address: null } }
      : {}),
  };
}
