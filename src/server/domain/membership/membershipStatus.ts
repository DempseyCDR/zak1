import { eq, sql } from "drizzle-orm";
import type { DbOrTx } from "@/server/db/client";
import type { MembershipLevel, MembershipStatus } from "@/server/db/schema";
import { clubSettings } from "@/server/db/schema";
import { classifyMembership } from "./classify";

/**
 * Feature 068 (FR-015): the ONE place a contact's membership is derived.
 *
 * Status is a function of the accounts covering a contact and TODAY — never of a stored column. That is
 * what makes the membership-year rollover a non-event: on 1 September 2026 the club's year turned and 118
 * memberships lapsed, but nothing noticed, because status was only recalculated when a contact happened to
 * be touched. `contacts.membership_status` and `list_member` survive as a write-refreshed cache; this is
 * the authority (research R3).
 *
 * Everything reads through here — the contact record, contact search, the member export, dedup candidates,
 * check-in — so there is one rule rather than five that drift.
 */
export type ContactMembership = {
  status: MembershipStatus;
  /** Most generous covering account's expiry (FR-010); null when nothing covers this contact. */
  expiryDate: string | null;
  /** The level of the account this contact PAYS FOR. Null for a member who pays for nothing (FR-013). */
  level: MembershipLevel | null;
  /** Covered by at least one account — the member-list rule (FR-011). */
  isMember: boolean;
};

async function lapseSettings(db: DbOrTx): Promise<{ cycles: number; cycle: string }> {
  const row = await db.query.clubSettings.findFirst({ where: eq(clubSettings.id, 1) });
  return { cycles: row?.longLapseCycles ?? 3, cycle: row?.cycleDefinition ?? "1 year" };
}

/**
 * A joinable projection of every contact's coverage. Kept as SQL so list and export paths stay one round
 * trip — deriving per contact in application code would be a textbook N+1 across ~1,900 contacts.
 *
 * `max_expiry` is the most generous covering account (FR-010). `paid_level` comes only from an account the
 * contact owns, because the level is the payer's attribute and is never contested (clarification Q3).
 */
export const contactCoverage = sql`
  contact_coverage AS (
    SELECT c.id AS contact_id,
           (SELECT MAX(a.expiry_date)
              FROM membership_members mm
              JOIN membership_accounts a ON a.id = mm.account_id
             WHERE mm.contact_id = c.id)                    AS max_expiry,
           (SELECT a.level FROM membership_accounts a
             WHERE a.payer_contact_id = c.id LIMIT 1)       AS paid_level,
           EXISTS (SELECT 1 FROM membership_members mm WHERE mm.contact_id = c.id) AS is_member
      FROM contacts c
  )
`;

/** Derive one contact's membership. The list paths join `contactCoverage` instead of calling this per row. */
export async function contactMembership(db: DbOrTx, contactId: string): Promise<ContactMembership> {
  const { cycles, cycle } = await lapseSettings(db);
  const rows = await db.execute<{
    max_expiry: string | null;
    paid_level: MembershipLevel | null;
    is_member: boolean;
  }>(sql`
    WITH ${contactCoverage}
    SELECT max_expiry, paid_level, is_member FROM contact_coverage WHERE contact_id = ${contactId}
  `);
  const row = [...rows][0];
  const expiry = row?.max_expiry ?? null;
  return {
    status: classifyMembership({
      mostRecentExpiry: expiry,
      now: new Date(),
      longLapseCycles: cycles,
      cycleDefinition: cycle,
    }),
    expiryDate: expiry,
    level: row?.paid_level ?? null,
    isMember: row?.is_member ?? false,
  };
}
