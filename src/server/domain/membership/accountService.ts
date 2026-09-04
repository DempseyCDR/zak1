import { and, eq, sql } from "drizzle-orm";
import type { Db, DbOrTx } from "@/server/db/client";
import { clubSettings, contacts, membershipAccounts, membershipMembers } from "@/server/db/schema";
import type { MembershipAccountRow, MembershipLevel } from "@/server/db/schema";
import { errors } from "@/server/lib/apiError";
import { recordAudit } from "@/server/lib/audit";
import { grantedMembershipExpiry } from "./membershipTerm";
import { recomputeContactStatus } from "./membershipService";
import type { MembershipPaymentInput } from "@/server/validation/memberships";

/**
 * Feature 068: membership accounts.
 *
 * Dues buy a HOUSEHOLD account owned by a payer, carrying a level (what the payer bought) and a validity
 * period (everyone's). Members are attached; attachment is what makes someone a member.
 */

/** FR-003a: individual and student cover the payer alone. Only family and supporter admit others. */
const SOLO_LEVELS: readonly MembershipLevel[] = ["individual", "student"];

export const levelAdmitsMembers = (level: MembershipLevel): boolean => !SOLO_LEVELS.includes(level);

async function yearEndBoundary(db: DbOrTx): Promise<string> {
  const row = await db.query.clubSettings.findFirst({ where: eq(clubSettings.id, 1) });
  return row?.membershipYearEnd ?? "08-31";
}

const accountOf = (db: DbOrTx, payerContactId: string) =>
  db.query.membershipAccounts.findFirst({
    where: eq(membershipAccounts.payerContactId, payerContactId),
  });

/** The people an account covers besides its payer — named in a capacity refusal (FR-003a). */
async function otherMemberNames(db: DbOrTx, accountId: string, payerId: string): Promise<string[]> {
  const rows = await db
    .select({ name: contacts.displayName })
    .from(membershipMembers)
    .innerJoin(contacts, eq(contacts.id, membershipMembers.contactId))
    .where(
      and(
        eq(membershipMembers.accountId, accountId),
        sql`${membershipMembers.contactId} <> ${payerId}`,
      ),
    );
  return rows.map((r) => r.name);
}

/**
 * Refresh the cached status/list-member for everyone an account covers.
 *
 * Status is DERIVED where it is read (FR-015), so nothing depends on this being current — but the cached
 * columns must not be wrong either (research R3), and several informational surfaces still display them.
 */
async function refreshCacheForAccount(db: DbOrTx, accountId: string, actor: string | null) {
  const rows = await db
    .select({ contactId: membershipMembers.contactId })
    .from(membershipMembers)
    .where(eq(membershipMembers.accountId, accountId));
  for (const r of rows) await recomputeContactStatus(db, r.contactId, "membership_change", actor);
}

/**
 * Record a dues payment (FR-001..FR-004, FR-024). Opens the payer's account, or moves the existing one
 * forward — a payer has at most one, durable account, so members are never re-attached at renewal.
 *
 * The expiry is DERIVED from the payment date; the FS never calculates it. The level is CHOSEN and is
 * independent of any amount (FR-003) — tiers change, and cheques bundle donations.
 */
export async function recordDuesPayment(
  db: Db,
  payerContactId: string,
  input: MembershipPaymentInput,
  actor: string | null,
): Promise<MembershipAccountRow> {
  return db.transaction(async (tx) => {
    const payer = await tx.query.contacts.findFirst({ where: eq(contacts.id, payerContactId) });
    if (!payer) throw errors.contactNotFound();

    const targetExpiry = grantedMembershipExpiry(input.paymentDate, await yearEndBoundary(tx));
    const existing = await accountOf(tx, payerContactId);

    if (!existing) {
      const [row] = await tx
        .insert(membershipAccounts)
        .values({
          payerContactId,
          level: input.level,
          expiryDate: targetExpiry,
          lastPaymentDate: input.paymentDate,
        })
        .returning();
      if (!row) throw new Error("account insert failed");
      // FR-007: the payer is a member of their own account, with no separate step.
      await tx.insert(membershipMembers).values({ accountId: row.id, contactId: payerContactId });
      await recordAudit(tx, {
        kind: "membership.payment_recorded",
        actorContactId: actor,
        details: {
          accountId: row.id,
          payerContactId,
          level: input.level,
          expiryDate: targetExpiry,
        },
      });
      await refreshCacheForAccount(tx, row.id, actor);
      return row;
    }

    // A level change at renewal must respect capacity, exactly as a direct change does (FR-024/FR-003a).
    if (input.level !== existing.level && !levelAdmitsMembers(input.level)) {
      const displaced = await otherMemberNames(tx, existing.id, payerContactId);
      if (displaced.length > 0) throw errors.levelCapacityExceeded(input.level, displaced);
    }

    // Renewal no-op: a payment that does not reach beyond current coverage never pulls it backwards.
    const expiryDate = targetExpiry > existing.expiryDate ? targetExpiry : existing.expiryDate;
    const [row] = await tx
      .update(membershipAccounts)
      .set({
        level: input.level,
        expiryDate,
        lastPaymentDate: input.paymentDate,
        updatedAt: new Date(),
      })
      .where(eq(membershipAccounts.id, existing.id))
      .returning();
    if (!row) throw new Error("account update failed");

    await recordAudit(tx, {
      kind: "membership.payment_recorded",
      actorContactId: actor,
      details: { accountId: row.id, payerContactId, level: input.level, expiryDate },
    });
    await refreshCacheForAccount(tx, row.id, actor);
    return row;
  });
}

/**
 * The payer's contact is being force-deleted (feature 065's unrestricted path). The account has no
 * meaning without an owner, and the database FK deliberately refuses to orphan it — so the deliberate
 * super-user path must clear it explicitly. Members detach via the account's own cascade.
 *
 * The SAFE delete never reaches here: account ownership is a blocker (FR-009).
 */
export async function deleteAccountOwnedBy(
  db: DbOrTx,
  payerContactId: string,
  actor: string | null = null,
): Promise<void> {
  const existing = await accountOf(db, payerContactId);
  if (!existing) return;
  await db.delete(membershipAccounts).where(eq(membershipAccounts.id, existing.id));
  await recordAudit(db, {
    kind: "membership.member_detached",
    actorContactId: actor,
    details: { accountId: existing.id, payerContactId, reason: "payer_contact_deleted" },
  });
}

/** Attach a contact as a member of the payer's account (FR-008/FR-022), within the level's capacity. */
export async function attachMember(
  db: DbOrTx,
  payerContactId: string,
  contactId: string,
  actor: string | null,
): Promise<void> {
  const account = await accountOf(db, payerContactId);
  if (!account) throw errors.accountNotFound();

  const already = await db
    .select({ contactId: membershipMembers.contactId })
    .from(membershipMembers)
    .where(
      and(eq(membershipMembers.accountId, account.id), eq(membershipMembers.contactId, contactId)),
    );
  if (already.length > 0) return; // idempotent

  // FR-003a: individual and student cover the payer alone.
  if (!levelAdmitsMembers(account.level)) throw errors.levelAdmitsNoMembers(account.level);

  await db.insert(membershipMembers).values({ accountId: account.id, contactId });
  await recordAudit(db, {
    kind: "membership.member_attached",
    actorContactId: actor,
    details: { accountId: account.id, contactId },
  });
  await recomputeContactStatus(db, contactId, "membership_change", actor);
}

/** Remove a member (FR-008/FR-022). The payer owns the account and cannot be removed from it (FR-009). */
export async function detachMember(
  db: DbOrTx,
  payerContactId: string,
  contactId: string,
  actor: string | null,
): Promise<void> {
  const account = await accountOf(db, payerContactId);
  if (!account) throw errors.accountNotFound();
  if (contactId === account.payerContactId) throw errors.payerNotDetachable();

  const removed = await db
    .delete(membershipMembers)
    .where(
      and(eq(membershipMembers.accountId, account.id), eq(membershipMembers.contactId, contactId)),
    )
    .returning({ contactId: membershipMembers.contactId });
  if (removed.length === 0) return; // detaching a non-member is a no-op

  await recordAudit(db, {
    kind: "membership.member_detached",
    actorContactId: actor,
    details: { accountId: account.id, contactId },
  });
  await recomputeContactStatus(db, contactId, "membership_change", actor);
}

/**
 * Change an account's level (FR-023). A reduction that would displace existing members is refused, and the
 * refusal NAMES them — the FS needs to know who to remove, not how many.
 */
export async function changeLevel(
  db: DbOrTx,
  payerContactId: string,
  level: MembershipLevel,
  actor: string | null,
): Promise<void> {
  const account = await accountOf(db, payerContactId);
  if (!account) throw errors.accountNotFound();
  if (account.level === level) return;

  if (!levelAdmitsMembers(level)) {
    const displaced = await otherMemberNames(db, account.id, account.payerContactId);
    if (displaced.length > 0) throw errors.levelCapacityExceeded(level, displaced);
  }

  await db
    .update(membershipAccounts)
    .set({ level, updatedAt: new Date() })
    .where(eq(membershipAccounts.id, account.id));
  await recordAudit(db, {
    kind: "membership.level_changed",
    actorContactId: actor,
    details: { accountId: account.id, from: account.level, to: level },
  });
}
