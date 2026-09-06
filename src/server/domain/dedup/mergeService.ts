import { and, eq, exists, ne, sql } from "drizzle-orm";
import type { Db, DbOrTx } from "@/server/db/client";
import {
  contactEmails,
  contacts,
  heldMerges,
  membershipAccounts,
  membershipMembers,
  mergeAudit,
  type HeldMergeReason,
} from "@/server/db/schema";
import { errors } from "@/server/lib/apiError";
import { writeAudit, recordAudit } from "@/server/lib/audit";
import { recomputeContactStatus } from "@/server/domain/membership/membershipService";

/** The capability that may answer a hold of each kind (FR-012/FR-013). */
export type HeldMergeReasonAuthority = "role.assign" | "dedup.write";

export type LoginCandidate = { emailId: string; email: string; contactDisplayName: string };
export type AccountCandidate = {
  accountId: string;
  level: string;
  expiryDate: string | null;
  payerDisplayName: string;
};

/**
 * Feature 069 (FR-011/FR-013). A merge has three possible endings, not two.
 *
 * `held` is the one that did not exist before: the merge is impossible to complete without an answer
 * nobody has given, so **nothing is written** and the question is recorded as its own piece of work. The
 * two cases are structurally identical — one login per contact, one account per payer — and both used to
 * surface as a raw Postgres unique-violation, which told Mel nothing and left her no way forward.
 *
 * (Refusals — same contact, already merged — stay thrown `ApiError`s, which is how every other route in
 * the app reports a bad request and what the contract's status table describes.)
 */
export type MergeOutcome =
  | { outcome: "completed"; canonicalId: string; moved: Record<string, number> }
  | {
      outcome: "held";
      reason: "two_logins";
      heldMergeId: string;
      candidates: LoginCandidate[];
    }
  | {
      outcome: "held";
      reason: "two_accounts";
      heldMergeId: string;
      candidates: AccountCandidate[];
    };

export type MergeResolution = {
  /** Chosen by a `role.assign` holder: which sign-in identity survives (FR-012). */
  survivingLoginEmailId?: string;
  /** Chosen by a `dedup.write` holder: which membership account survives. */
  survivingAccountId?: string;
};

const loginsOf = (db: DbOrTx, contactId: string) =>
  db
    .select({
      emailId: contactEmails.id,
      email: contactEmails.email,
      contactDisplayName: contacts.displayName,
    })
    .from(contactEmails)
    .innerJoin(contacts, eq(contacts.id, contactEmails.contactId))
    .where(and(eq(contactEmails.contactId, contactId), eq(contactEmails.isLogin, true)));

const accountsOf = (db: DbOrTx, contactId: string) =>
  db
    .select({
      accountId: membershipAccounts.id,
      level: membershipAccounts.level,
      expiryDate: membershipAccounts.expiryDate,
      payerDisplayName: contacts.displayName,
    })
    .from(membershipAccounts)
    .innerJoin(contacts, eq(contacts.id, membershipAccounts.payerContactId))
    .where(eq(membershipAccounts.payerContactId, contactId));

/**
 * Record the hold, or return the one already standing for this pair. Kept OUTSIDE the merge transaction
 * on purpose: a hold must survive precisely because the merge did not happen.
 */
async function hold(
  db: Db,
  canonicalId: string,
  mergedId: string,
  reason: HeldMergeReason,
  actor: string,
): Promise<string> {
  const existing = await db.query.heldMerges.findFirst({
    where: and(
      eq(heldMerges.canonicalId, canonicalId),
      eq(heldMerges.mergedId, mergedId),
      sql`${heldMerges.resolvedAt} IS NULL`,
    ),
  });
  if (existing) return existing.id;

  const [row] = await db
    .insert(heldMerges)
    .values({ canonicalId, mergedId, reason, attemptedBy: actor })
    .returning({ id: heldMerges.id });
  await recordAudit(db, {
    kind: "dedup.merge_held",
    actorContactId: actor,
    details: { canonicalId, mergedId, reason },
  });
  return row!.id;
}

/**
 * Admin-confirmed, transactional merge (no automatic merges). Re-links all related records from the
 * merged contact to the canonical one, soft-retires the merged contact via merged_into_id, recomputes
 * the canonical status, and writes an append-only merge audit row.
 *
 * Feature 069: both collisions are detected BEFORE anything is written, so a held merge leaves the data
 * exactly as it found it — there is no partial merge to unpick and nothing to explain to Mel afterwards.
 */
export async function mergeContacts(
  db: Db,
  canonicalId: string,
  mergedId: string,
  actor: string,
  resolution: MergeResolution = {},
): Promise<MergeOutcome> {
  if (canonicalId === mergedId) throw errors.sameContact();

  const canonical = await db.query.contacts.findFirst({ where: eq(contacts.id, canonicalId) });
  const merged = await db.query.contacts.findFirst({ where: eq(contacts.id, mergedId) });
  if (!canonical || !merged) throw errors.contactNotFound();
  if (canonical.mergedIntoId !== null || merged.mergedIntoId !== null) throw errors.alreadyMerged();

  const [canonicalLogins, mergedLogins] = await Promise.all([
    loginsOf(db, canonicalId),
    loginsOf(db, mergedId),
  ]);
  if (canonicalLogins.length > 0 && mergedLogins.length > 0 && !resolution.survivingLoginEmailId) {
    return {
      outcome: "held",
      reason: "two_logins",
      heldMergeId: await hold(db, canonicalId, mergedId, "two_logins", actor),
      candidates: [...canonicalLogins, ...mergedLogins],
    };
  }

  const [canonicalAccounts, mergedAccounts] = await Promise.all([
    accountsOf(db, canonicalId),
    accountsOf(db, mergedId),
  ]);
  if (canonicalAccounts.length > 0 && mergedAccounts.length > 0 && !resolution.survivingAccountId) {
    return {
      outcome: "held",
      reason: "two_accounts",
      heldMergeId: await hold(db, canonicalId, mergedId, "two_accounts", actor),
      candidates: [...canonicalAccounts, ...mergedAccounts],
    };
  }

  return db.transaction(async (tx) => {
    // Apply the sign-in choice before relinking, so the partial unique index sees one login (FR-012).
    if (resolution.survivingLoginEmailId) {
      await tx
        .update(contactEmails)
        .set({ isLogin: false })
        .where(
          and(
            sql`${contactEmails.contactId} IN (${canonicalId}, ${mergedId})`,
            eq(contactEmails.isLogin, true),
            ne(contactEmails.id, resolution.survivingLoginEmailId),
          ),
        );
    }

    // Apply the account choice the same way: fold the losing household in, then drop the empty account.
    // Nobody attached to the account that was NOT kept loses their membership because of this merge.
    // ⚠️ DESTRUCTIVE: the account not chosen is DELETED, taking its level, expiry and last-payment date
    // with it. Only the attachments survive, moved onto the surviving account.
    if (resolution.survivingAccountId) {
      const losing = [...canonicalAccounts, ...mergedAccounts]
        .map((a) => a.accountId)
        .filter((id) => id !== resolution.survivingAccountId);
      for (const accountId of losing) {
        await tx.execute(sql`
          INSERT INTO membership_members (account_id, contact_id)
          SELECT ${resolution.survivingAccountId}, mm.contact_id
            FROM membership_members mm WHERE mm.account_id = ${accountId}
          ON CONFLICT DO NOTHING
        `);
        await tx.delete(membershipAccounts).where(eq(membershipAccounts.id, accountId));
      }
    }

    const relinkedEmails = await tx
      .update(contactEmails)
      .set({ contactId: canonicalId })
      .where(eq(contactEmails.contactId, mergedId))
      .returning({ id: contactEmails.id });

    // Feature 069 (FR-010). Feature 068 replaced `memberships` / `payers` with membership ACCOUNTS but
    // left this service relinking the retired tables, so a merged account owner's household would have
    // been stranded on a contact no read can reach. Ownership moves first, then attachments.
    const movedAccounts = await tx
      .update(membershipAccounts)
      .set({ payerContactId: canonicalId })
      .where(eq(membershipAccounts.payerContactId, mergedId))
      .returning({ id: membershipAccounts.id });

    // Both contacts may be attached to the SAME account (the duplicate was added to the household
    // twice under two spellings). The PK is (account_id, contact_id), so drop the losing row rather
    // than collide; the survivor is already attached, and the household is unchanged either way.
    // ⚠️ DESTRUCTIVE and unrecorded: this row is gone, and nothing says it existed.
    await tx.delete(membershipMembers).where(
      and(
        eq(membershipMembers.contactId, mergedId),
        exists(
          tx
            .select({ one: sql`1` })
            .from(sql`${membershipMembers} AS survivor`)
            .where(
              sql`survivor.account_id = ${membershipMembers}.account_id AND survivor.contact_id = ${canonicalId}`,
            ),
        ),
      ),
    );
    const movedMembers = await tx
      .update(membershipMembers)
      .set({ contactId: canonicalId })
      .where(eq(membershipMembers.contactId, mergedId))
      .returning({ accountId: membershipMembers.accountId });

    // Soft-retire the merged contact: the row itself survives intact — names, phone, pronouns, source
    // and timestamps are all untouched — so clearing `merged_into_id` brings the contact back.
    //
    // ⚠️ That is NOT the same as an undo. The RELINKING above is one-way: `merge_audit` records only
    // COUNTS, never which rows moved, so once these emails and attachments sit on the survivor nothing
    // distinguishes them from its own. There is no unmerge path, and recovering from a mistaken merge
    // means restoring the database. See the follow-up in specs/069-triage-worklists/tasks.md.
    await tx
      .update(contacts)
      .set({ mergedIntoId: canonicalId, updatedAt: new Date() })
      .where(eq(contacts.id, mergedId));

    // Canonical may have gained membership coverage → recompute its cached status.
    await recomputeContactStatus(tx, canonicalId, "membership_change", actor);

    const moved = {
      contact_emails: relinkedEmails.length,
      membership_accounts: movedAccounts.length,
      membership_members: movedMembers.length,
    };

    await tx.insert(mergeAudit).values({ canonicalId, mergedId, actor, relinkedCounts: moved });
    writeAudit({ kind: "contact.merge", actor, details: { canonicalId, mergedId, moved } });

    return { outcome: "completed" as const, canonicalId, moved };
  });
}
