import { inArray, eq } from "drizzle-orm";
import type { Db, Tx } from "@/server/db/client";
import {
  auditEvents,
  contactEmails,
  contacts,
  mergeAudit,
  membershipAccounts,
  membershipMembers,
  performers,
  roleGrants,
} from "@/server/db/schema";
import { deriveContactNames } from "@/server/domain/contacts/normalize";
import { recomputeContactStatus } from "@/server/domain/membership/membershipService";
import { recordAudit } from "@/server/lib/audit";
import { buildRoster } from "./buildRoster";
import { buildMemberships } from "./buildMemberships";
import { matchPerformers } from "./matchPerformers";
import { emptyCounts } from "./loadPlan";
import type {
  IcontactRow,
  LoadCounts,
  MemberRow,
  PayerInput,
  PerformerResolution,
} from "./loadPlan";

export type LoadInput = {
  icontact: IcontactRow[];
  members: MemberRow[];
  payers: PayerInput[];
};

export type LoadResult = { counts: LoadCounts; resolution: PerformerResolution };

/** Thrown to abort the transaction after computing a dry-run's counts, so nothing persists. */
class DryRunRollback extends Error {}

/**
 * Feature 044 — apply (or, in dry-run, compute-then-roll-back) the contact load in ONE transaction.
 *
 * The whole thing runs inside `db.transaction`. In dry-run we execute every write and then throw
 * `DryRunRollback`, so the reported counts are exactly what a commit would produce while nothing is
 * persisted (FR-013) — the same rollback path that guarantees all-or-nothing on failure (FR-015).
 */
export async function executeContactLoad(
  db: Db,
  input: LoadInput,
  opts: { dryRun: boolean },
): Promise<LoadResult> {
  let result: LoadResult = {
    counts: emptyCounts(),
    resolution: { auto: [], ambiguous: [], unmatched: [] },
  };
  try {
    await db.transaction(async (tx) => {
      result = await applyLoad(tx, input, opts.dryRun);
      if (opts.dryRun) throw new DryRunRollback();
    });
  } catch (err) {
    if (!(err instanceof DryRunRollback)) throw err;
  }
  return result;
}

async function applyLoad(tx: Tx, input: LoadInput, dryRun: boolean): Promise<LoadResult> {
  const counts = emptyCounts();
  const roster = buildRoster(input.icontact, input.members);
  const { payers: plannedPayers, memberships: plannedMemberships } = buildMemberships(
    roster,
    input.payers,
  );

  // --- Retention: role-grant holders ∪ merge parties (FR-018/FR-021). ---
  const grantRows = await tx.select({ id: roleGrants.contactId }).from(roleGrants);
  const mergeRows = await tx
    .select({ a: mergeAudit.canonicalId, b: mergeAudit.mergedId })
    .from(mergeAudit);
  const retained = new Set<string>();
  for (const r of grantRows) retained.add(r.id);
  for (const r of mergeRows) {
    retained.add(r.a);
    retained.add(r.b);
  }

  const allIds = await tx.select({ id: contacts.id }).from(contacts);
  const deletionTargets = allIds.map((r) => r.id).filter((id) => !retained.has(id));
  counts.retained = allIds.length - deletionTargets.length;
  counts.removed = deletionTargets.length;

  if (deletionTargets.length > 0) {
    // FR-021: null the nullable RESTRICT refs so the delete cannot violate a foreign key.
    await tx
      .update(auditEvents)
      .set({ actorContactId: null })
      .where(inArray(auditEvents.actorContactId, deletionTargets));
    await tx
      .update(roleGrants)
      .set({ grantedBy: null })
      .where(inArray(roleGrants.grantedBy, deletionTargets));
    await tx.delete(contacts).where(inArray(contacts.id, deletionTargets));
  }

  // --- Reconcile against surviving contacts, then insert/update the roster. ---
  const survivors = await tx
    .select({ id: contacts.id, dedup: contacts.dedupNormalized })
    .from(contacts);
  const survivorEmails = await tx
    .select({ contactId: contactEmails.contactId, email: contactEmails.email })
    .from(contactEmails);
  const byEmail = new Map<string, string>();
  const byDedup = new Map<string, string>();
  for (const s of survivors) if (!byDedup.has(s.dedup)) byDedup.set(s.dedup, s.id);
  for (const e of survivorEmails) byEmail.set(e.email.toLowerCase(), e.contactId);
  const existingEmailsByContact = new Map<string, Set<string>>();
  for (const e of survivorEmails) {
    const set = existingEmailsByContact.get(e.contactId) ?? new Set<string>();
    set.add(e.email.toLowerCase());
    existingEmailsByContact.set(e.contactId, set);
  }

  const dedupToId = new Map<string, string>();

  for (const pc of roster) {
    const names = deriveContactNames({
      firstName: pc.firstName,
      lastName: pc.lastName,
      displayNameOverride: pc.displayNameOverride,
    });

    let matchId: string | null = null;
    for (const e of pc.emails) {
      const hit = byEmail.get(e.email);
      if (hit) {
        matchId = hit;
        break;
      }
    }
    if (!matchId) matchId = byDedup.get(pc.dedupKey) ?? null;

    if (matchId) {
      // Update a surviving (retained) contact in place — never duplicate (FR-001 scenario 1).
      const set: Record<string, unknown> = {
        firstName: pc.firstName,
        lastName: pc.lastName,
        displayNameOverride: pc.displayNameOverride,
        displayName: names.displayName,
        nameNormalized: names.nameNormalized,
        dedupNormalized: names.dedupNormalized,
        pronouns: pc.pronouns,
        phone: pc.phone,
        updatedAt: new Date(),
      };
      // Never downgrade eligibility/review on a retained contact.
      if (pc.isVolunteer) set.isVolunteer = true;
      if (pc.needsReview) set.needsReview = true;
      await tx.update(contacts).set(set).where(eq(contacts.id, matchId));
      counts.contactsUpdated++;
      dedupToId.set(pc.dedupKey, matchId);

      const already = existingEmailsByContact.get(matchId) ?? new Set<string>();
      for (const e of pc.emails) {
        if (already.has(e.email.toLowerCase())) continue;
        await insertEmail(tx, matchId, e);
        counts.emailsCreated++;
      }
    } else {
      const [row] = await tx
        .insert(contacts)
        .values({
          firstName: pc.firstName,
          lastName: pc.lastName,
          displayNameOverride: pc.displayNameOverride,
          displayName: names.displayName,
          nameNormalized: names.nameNormalized,
          dedupNormalized: names.dedupNormalized,
          pronouns: pc.pronouns,
          phone: pc.phone,
          isVolunteer: pc.isVolunteer,
          needsReview: pc.needsReview,
          membershipStatus: "never",
          source: "contact_load",
        })
        .returning({ id: contacts.id });
      if (!row) throw new Error("contact insert failed");
      dedupToId.set(pc.dedupKey, row.id);
      counts.contactsCreated++;
      for (const e of pc.emails) {
        await insertEmail(tx, row.id, e);
        counts.emailsCreated++;
      }
    }

    if (pc.isVolunteer) counts.volunteersSet++;
    if (pc.needsReview) counts.needsReview++;
  }

  // --- Membership accounts (FR-009/FR-020), then status recompute (FR-010). ---
  //
  // Feature 068: the workbook's Payer sheet was ALWAYS account-shaped — one payer covering N members at a
  // shared level and expiry — so the planning stage below already produces exactly what an account is.
  // Only the storage changed: one account per payer group with its members attached, rather than a row per
  // person with the level and expiry copied across the household. Left on the legacy tables, a re-run of
  // this load would import members that nothing reads.
  const payerKeyToAccountId = new Map<string, string>();
  const affected = new Set<string>();

  for (const pm of plannedMemberships) {
    const contactId = dedupToId.get(pm.contactDedupKey);
    if (!contactId) continue;

    let accountId = payerKeyToAccountId.get(pm.payerKey);
    if (!accountId) {
      const planned = plannedPayers.find((pp) => pp.key === pm.payerKey);
      // The payer→contact link is the member whose dedup key matches the Payer Name (FR-020); where the
      // sheet names someone not in the roster, the account is owned by this first covered member so it is
      // never left ownerless (FR-009).
      const ownerId =
        (planned?.contactDedupKey ? dedupToId.get(planned.contactDedupKey) : undefined) ??
        contactId;

      const existing = await tx.query.membershipAccounts.findFirst({
        where: eq(membershipAccounts.payerContactId, ownerId),
      });
      const [row] = existing
        ? [existing]
        : await tx
            .insert(membershipAccounts)
            .values({ payerContactId: ownerId, level: pm.level, expiryDate: pm.expiry })
            .returning();
      if (!row) throw new Error("membership account insert failed");
      accountId = row.id;
      payerKeyToAccountId.set(pm.payerKey, accountId);

      await tx
        .insert(membershipMembers)
        .values({ accountId, contactId: ownerId })
        .onConflictDoNothing();
      affected.add(ownerId);
    }

    await tx.insert(membershipMembers).values({ accountId, contactId }).onConflictDoNothing();
    counts.membershipsCreated++;
    counts.membershipsByLevel[pm.level]++;
    affected.add(contactId);
  }

  for (const id of affected) {
    await recomputeContactStatus(tx, id, "membership_change", "contact_load");
  }

  // --- Performer link proposals (FR-012). ---
  const resolution = await matchPerformers(tx);
  for (const link of resolution.auto) {
    await tx
      .update(performers)
      .set({ contactId: link.contactId, updatedAt: new Date() })
      .where(eq(performers.id, link.performerId));
  }
  counts.performerAuto = resolution.auto.length;
  counts.performerAmbiguous = resolution.ambiguous.length;
  counts.performerUnmatched = resolution.unmatched.length;

  // Durable audit row on commit; on dry-run the surrounding transaction rolls back and no row remains.
  if (!dryRun) {
    await recordAudit(tx, {
      kind: "contact.bulk_load",
      actorContactId: null,
      details: { ...counts },
    });
  }

  return { counts, resolution };
}

async function insertEmail(
  tx: Tx,
  contactId: string,
  e: {
    email: string;
    consentTopics: string[];
    providerSetDate: Date | null;
    providerLastOpen: Date | null;
    providerLastClick: Date | null;
  },
): Promise<void> {
  await tx.insert(contactEmails).values({
    contactId,
    email: e.email,
    consentTopics: e.consentTopics as (typeof contactEmails.$inferInsert)["consentTopics"],
    status: "active",
    providerSetDate: e.providerSetDate,
    providerLastOpen: e.providerLastOpen,
    providerLastClick: e.providerLastClick,
  });
}
