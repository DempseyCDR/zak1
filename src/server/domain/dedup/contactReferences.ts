import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
  attendance,
  auditEvents,
  contactEmails,
  contacts,
  dedupRejections,
  gateSales,
  heldMerges,
  membershipAccounts,
  membershipCaptures,
  membershipMembers,
  mergeAudit,
  officers,
  performers,
  roleGrants,
  staffIdentities,
  statusChangeAudit,
  venues,
} from "@/server/db/schema";

/**
 * Feature 072 (FR-002, FR-002a): what a merge does with every reference to a contact.
 *
 * ## Why this is a list and not a rule in `mergeService`
 *
 * FR-002 states the rule — "move everything except the audit trail" — and the point of writing it down
 * HERE is that `mergeService` iterates this, and a guard checks it against the live database. Feature 068
 * replaced the membership tables and the merge kept relinking the retired pair for two releases, because
 * the only place saying which tables to move was the merge itself. Nothing failed; it just quietly did
 * the wrong thing. An unclassified reference now breaks the build instead
 * (`tests/integration/dedup.contactReferences.test.ts`).
 *
 * ## The distinction
 *
 * `move` is what a person OWNS — how they are reached, what they attended, what they bought, who they
 * are on stage, the seat they hold. It follows them to the surviving record.
 *
 * `leave` is what a person DID — the actor on an audit row, the judge of a duplicate pair, the granter of
 * a role. Re-pointing those at the survivor would falsify the historical record: it would claim the
 * surviving contact took actions it never took.
 *
 * Classification is per COLUMN, not per table. `dedup_rejections` has three references and they are not
 * all alike; `role_grants` has two that fall on opposite sides.
 */
export type ContactReferenceDisposition = "move" | "leave" | "structural";

export type ContactReference = {
  /** Bare table name, matching `conrelid::regclass::text` so the guard can compare directly. */
  table: string;
  column: string;
  disposition: ContactReferenceDisposition;
  /**
   * The Drizzle column. Carried by EVERY entry, not just the moved ones: a renamed column then fails to
   * compile here, rather than only surfacing when the parity guard next runs against a database.
   */
  col: AnyPgColumn;
  /**
   * A `move` that cannot be done unconditionally, because completing it may require a decision no
   * ordinary merge is entitled to make. These are relinked by their own guarded path in `mergeService`,
   * never by the generic loop — see FR-006/FR-007 for grants and FR-011/FR-012 for sign-in.
   */
  conditional?: true;
  why: string;
};

export const CONTACT_REFERENCES: readonly ContactReference[] = [
  // ---------------------------------------------------------------- move (11)
  {
    table: "contact_emails",
    column: "contact_id",
    disposition: "move",
    col: contactEmails.contactId,
    why: "How the person is reached. Moved since the original dedup feature.",
  },
  {
    table: "membership_accounts",
    column: "payer_contact_id",
    disposition: "move",
    col: membershipAccounts.payerContactId,
    why: "The household they pay for. Unique per payer, so two payers raise a `two_accounts` hold.",
  },
  {
    table: "membership_members",
    column: "contact_id",
    disposition: "move",
    col: membershipMembers.contactId,
    why: "The household covering them. Both contacts may be on one account — the duplicate is dropped.",
  },
  {
    table: "attendance",
    column: "contact_id",
    disposition: "move",
    col: attendance.contactId,
    why: "Their check-in history. Unique per (event, contact), so a shared event drops the duplicate.",
  },
  {
    table: "gate_sales",
    column: "contact_id",
    disposition: "move",
    col: gateSales.contactId,
    why: "What they bought at the door — a named receipt that belongs to the person.",
  },
  {
    table: "membership_captures",
    column: "contact_id",
    disposition: "move",
    col: membershipCaptures.contactId,
    why: "An online membership purchase resolved to this person.",
  },
  {
    table: "performers",
    column: "contact_id",
    disposition: "move",
    col: performers.contactId,
    why:
      "Who they are on stage. Leaving this behind is what hid the Booker's email link, dropped them " +
      "from the performer mailing list, and let the open-band guard double-subtract them.",
  },
  {
    table: "officers",
    column: "contact_id",
    disposition: "move",
    col: officers.contactId,
    why: "The seat they hold. Unique on the SEAT, not the contact, so this cannot collide.",
  },
  {
    table: "venues",
    column: "landlord_contact_id",
    disposition: "move",
    col: venues.landlordContactId,
    why: "The hall they rent to the club.",
  },
  {
    table: "role_grants",
    column: "contact_id",
    disposition: "move",
    col: roleGrants.contactId,
    conditional: true,
    why:
      "What they may do. Moved only when it would not compound privilege — otherwise the merge is " +
      "held as `role_conflict` (FR-006/FR-007).",
  },
  {
    table: "staff_identities",
    column: "contact_id",
    disposition: "move",
    col: staffIdentities.contactId,
    conditional: true,
    why:
      "Their sign-in. Unique per contact, so two sign-ins raise a `two_logins` hold; where only one " +
      "record has it, it moves.",
  },

  // --------------------------------------------------------------- leave (12)
  {
    table: "status_change_audit",
    column: "contact_id",
    disposition: "leave",
    col: statusChangeAudit.contactId,
    why: "The retired contact's own status history — it happened to that record.",
  },
  {
    table: "merge_audit",
    column: "canonical_id",
    disposition: "leave",
    col: mergeAudit.canonicalId,
    why: "Names the merge that happened. Rewriting it would erase the event it records.",
  },
  {
    table: "merge_audit",
    column: "merged_id",
    disposition: "leave",
    col: mergeAudit.mergedId,
    why: "Likewise — this is the contact that WAS merged, permanently.",
  },
  {
    table: "audit_events",
    column: "actor_contact_id",
    disposition: "leave",
    col: auditEvents.actorContactId,
    why: "Who performed an action. The survivor did not perform it.",
  },
  {
    table: "dedup_rejections",
    column: "rejected_by",
    disposition: "leave",
    col: dedupRejections.rejectedBy,
    why: "Who judged a pair not to be duplicates.",
  },
  {
    table: "dedup_rejections",
    column: "contact_a_id",
    disposition: "leave",
    col: dedupRejections.contactAId,
    why:
      "The pair as it was judged. A merged contact is excluded from the suggestion query, so a stale " +
      "rejection can never match — and re-pointing it would invent a judgement nobody made.",
  },
  {
    table: "dedup_rejections",
    column: "contact_b_id",
    disposition: "leave",
    col: dedupRejections.contactBId,
    why: "As above — the other half of the judged pair.",
  },
  {
    table: "held_merges",
    column: "attempted_by",
    disposition: "leave",
    col: heldMerges.attemptedBy,
    why: "Who attempted the merge.",
  },
  {
    table: "held_merges",
    column: "canonical_id",
    disposition: "leave",
    col: heldMerges.canonicalId,
    why: "The merge attempted, as attempted. The hold auto-closes when either contact is retired.",
  },
  {
    table: "held_merges",
    column: "merged_id",
    disposition: "leave",
    col: heldMerges.mergedId,
    why: "As above.",
  },
  {
    table: "contacts",
    column: "volunteer_approved_by",
    disposition: "leave",
    col: contacts.volunteerApprovedBy,
    why: "Who approved a volunteer, at the annual review.",
  },
  {
    table: "role_grants",
    column: "granted_by",
    disposition: "leave",
    col: roleGrants.grantedBy,
    why:
      "Who granted the role — the other reference on this table, and the opposite disposition to " +
      "`role_grants.contact_id` above. This is why the classification is per column.",
  },

  // ---------------------------------------------------------- structural (1)
  {
    table: "contacts",
    column: "merged_into_id",
    disposition: "structural",
    col: contacts.mergedIntoId,
    why:
      "This IS the retirement marker, not an attachment. Never re-pointed: flattening a chain would " +
      "rewrite which merge actually happened. Readers needing the final survivor follow the chain.",
  },
];

/** Everything a merge moves, conditional entries included. */
export const MOVED_REFERENCES = CONTACT_REFERENCES.filter((r) => r.disposition === "move");

/**
 * What the generic relink loop iterates (FR-001) — every moved reference except the two that need a
 * guarded path of their own. Keeping the exclusion here, rather than as a hard-coded skip inside
 * `mergeService`, means a reader of the classification can see which entries are special and why.
 */
export const UNCONDITIONAL_MOVES = MOVED_REFERENCES.filter((r) => !r.conditional);
