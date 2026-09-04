import { eq, sql } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import {
  contacts,
  membershipAccounts,
  membershipMembers,
  memberships,
  payers,
} from "@/server/db/schema";
import type { MembershipLevel } from "@/server/db/schema";
import { deriveContactNames } from "@/server/domain/contacts/normalize";
import { recomputeContactStatus } from "./membershipService";

/**
 * Feature 068 (FR-016, FR-021): move the club's existing memberships onto the account model.
 *
 * The data was ALREADY shaped this way — 56 of 154 rows had a payer who was not the member, 31 payers
 * covered several people, and level and expiry were perfectly consistent within every payer group. Only
 * the storage was wrong: one row per member, with the level and expiry copied across the household. So
 * this is a regrouping, not a reconciliation — there are no conflicts to resolve, and `MAX(expiry)` is a
 * formality that also folds in the handful of contacts who had renewed.
 *
 * Written as a callable routine rather than SQL inside a migration so it can be TESTED: the test database
 * starts empty, so a move embedded in a migration could never be exercised against realistic input.
 */
export type MigrationReport = {
  accountsCreated: number;
  membersAttached: number;
  /** Contact-less payers matched to an existing contact by name (FR-021). */
  payersMatchedByName: number;
  /** Contacts created for unmatched payers, each flagged `needs_review` (FR-021). */
  contactsCreated: number;
};

/** Resolve a legacy payer to a contact: its own link, else a name match, else a new flagged contact. */
async function resolveOwner(
  db: Db,
  payer: { id: string; name: string; contactId: string | null },
  report: MigrationReport,
): Promise<string> {
  if (payer.contactId) return payer.contactId;

  const byName = await db.query.contacts.findFirst({
    where: sql`lower(${contacts.displayName}) = lower(${payer.name})`,
  });
  if (byName) {
    report.payersMatchedByName++;
    return byName.id;
  }

  // No match: create the contact rather than leave the account ownerless (FR-009), and FLAG it so a human
  // sees what the migration invented rather than trusting a name off a spreadsheet (SC-007).
  const names = deriveContactNames({ firstName: payer.name, lastName: null });
  const [created] = await db
    .insert(contacts)
    .values({
      firstName: payer.name,
      lastName: null,
      displayName: names.displayName,
      nameNormalized: names.nameNormalized,
      dedupNormalized: names.dedupNormalized,
      needsReview: true,
      source: "membership_migration",
    })
    .returning();
  if (!created) throw new Error("payer contact insert failed");
  report.contactsCreated++;
  return created.id;
}

export async function migrateToAccounts(db: Db): Promise<MigrationReport> {
  const report: MigrationReport = {
    accountsCreated: 0,
    membersAttached: 0,
    payersMatchedByName: 0,
    contactsCreated: 0,
  };

  const legacyPayers = await db.select().from(payers);
  for (const payer of legacyPayers) {
    const rows = await db.select().from(memberships).where(eq(memberships.payerId, payer.id));
    if (rows.length === 0) continue; // a payer that owns nothing is not an account

    const ownerContactId = await resolveOwner(db, payer, report);

    // Idempotent: a payer already migrated keeps the account they have.
    const existing = await db.query.membershipAccounts.findFirst({
      where: eq(membershipAccounts.payerContactId, ownerContactId),
    });

    const level = (rows[0]!.level ?? "individual") as MembershipLevel;
    const expiry = rows.reduce(
      (max, r) => (r.expiryDate > max ? r.expiryDate : max),
      rows[0]!.expiryDate,
    );

    const accountId =
      existing?.id ??
      (
        await db
          .insert(membershipAccounts)
          .values({ payerContactId: ownerContactId, level, expiryDate: expiry })
          .returning()
      )[0]!.id;
    if (!existing) report.accountsCreated++;

    // Every covered contact, plus the payer — who is a member of their own account even where the legacy
    // rows never said so (FR-007).
    const covered = new Set<string>([ownerContactId, ...rows.map((r) => r.contactId)]);
    for (const contactId of covered) {
      const already = await db.query.membershipMembers.findFirst({
        where: sql`${membershipMembers.accountId} = ${accountId} AND ${membershipMembers.contactId} = ${contactId}`,
      });
      if (already) continue;
      await db.insert(membershipMembers).values({ accountId, contactId });
      report.membersAttached++;
    }

    // Bring the cached status/list-member into line for everyone now covered (FR-015a).
    for (const contactId of covered) {
      await recomputeContactStatus(db, contactId, "membership_change", null);
    }
  }

  return report;
}
