import { and, eq, isNull, sql } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import {
  contactEmails,
  heldMerges,
  membershipAccounts,
  roleGrants,
  staffIdentities,
} from "@/server/db/schema";
import type { HeldMergeReason } from "@/server/db/schema";
import { errors } from "@/server/lib/apiError";
import { recordAudit } from "@/server/lib/audit";
import {
  bothCanSignIn,
  findRoleConflicts,
  mergeContacts,
  type HeldMergeReasonAuthority,
  type MergeOutcome,
} from "./mergeService";

export type HeldMergeItem = {
  id: string;
  reason: HeldMergeReason;
  canonicalId: string;
  canonicalDisplayName: string;
  mergedId: string;
  mergedDisplayName: string;
  attemptedAt: string;
};

/**
 * Feature 069 (FR-014). A held merge is its OWN piece of work, not a note on a contact — which is why it
 * survives clearing either contact's review flag and why clearing it changes no flag (FR-014a).
 *
 * A hold is closed automatically when the question it asks stops arising: either contact merged away or
 * archived, or the colliding thing gone (one of the two sign-ins withdrawn, one of the two accounts
 * closed). That check runs on read rather than on a trigger, because every path that could remove the
 * cause would otherwise have to remember this table exists.
 */
async function closeStaleHolds(db: Db): Promise<void> {
  await db.execute(sql`
    UPDATE held_merges h
       SET resolved_at = now()
     WHERE h.resolved_at IS NULL
       AND (
         EXISTS (SELECT 1 FROM contacts c
                  WHERE c.id IN (h.canonical_id, h.merged_id)
                    AND (c.merged_into_id IS NOT NULL OR c.archived_at IS NOT NULL))
         OR (h.reason = 'two_accounts' AND (
               SELECT COUNT(*) FROM membership_accounts ma
                WHERE ma.payer_contact_id IN (h.canonical_id, h.merged_id)) < 2)
       )
  `);
}

export async function listHeldMerges(db: Db): Promise<HeldMergeItem[]> {
  await closeStaleHolds(db);
  await closeStaleByDetection(db);
  const rows = await db.execute<{
    id: string;
    reason: HeldMergeReason;
    canonical_id: string;
    canonical_name: string;
    merged_id: string;
    merged_name: string;
    attempted_at: string;
  }>(sql`
    SELECT h.id, h.reason::text AS reason,
           h.canonical_id, ca.display_name AS canonical_name,
           h.merged_id, cb.display_name AS merged_name,
           h.attempted_at
      FROM held_merges h
      JOIN contacts ca ON ca.id = h.canonical_id
      JOIN contacts cb ON cb.id = h.merged_id
     WHERE h.resolved_at IS NULL
     ORDER BY h.attempted_at
  `);
  return [...rows].map((r) => ({
    id: r.id,
    reason: r.reason,
    canonicalId: r.canonical_id,
    canonicalDisplayName: r.canonical_name,
    mergedId: r.merged_id,
    mergedDisplayName: r.merged_name,
    attemptedAt: String(r.attempted_at),
  }));
}

/** Which authority a hold's reason demands — the route gates on this (FR-012/FR-013). */
export function authorityFor(reason: HeldMergeReason): HeldMergeReasonAuthority {
  // Feature 072: a role conflict is a governance decision, like choosing a surviving sign-in. Only an
  // account choice is ordinary duplicate work.
  return reason === "two_accounts" ? "dedup.write" : "role.assign";
}

/**
 * Feature 072 (FR-010a): close a hold whose obstacle is gone, by asking the SAME question the merge asks.
 *
 * This lives in TypeScript rather than the SQL sweep above deliberately. When the two were written
 * separately they drifted: the sweep counted login addresses while the merge also checked sign-in
 * identities, so clearing one address closed the hold and the next attempt raised it again — a loop with
 * no exit. Calling the detection itself is what makes that impossible.
 *
 * A `role_conflict` closes when the union stops triggering — typically because an
 * officer withdrew the conflicting grant on the access screen. That check is the same one the merge runs,
 * so it lives in TypeScript rather than the SQL sweep above; duplicating it as SQL would let the two
 * drift, and this is the route by which a hold is recoverable with no resolution screen.
 */
/** Does either contact actually hold a Google account binding? (See the FR-012a note above.) */
async function pairHasIdentity(db: Db, canonicalId: string, mergedId: string): Promise<boolean> {
  const rows = await db
    .select({ id: staffIdentities.id })
    .from(staffIdentities)
    .where(sql`${staffIdentities.contactId} IN (${canonicalId}, ${mergedId})`);
  return rows.length > 0;
}

async function closeStaleByDetection(db: Db): Promise<void> {
  const open = await db.query.heldMerges.findMany({ where: isNull(heldMerges.resolvedAt) });
  for (const h of open) {
    const stillBlocked =
      h.reason === "role_conflict"
        ? (await findRoleConflicts(db, h.canonicalId, h.mergedId)).length > 0
        : h.reason === "two_logins"
          ? await bothCanSignIn(db, h.canonicalId, h.mergedId)
          : true; // `two_accounts` is handled by the SQL sweep, whose count matches its detection.
    if (!stillBlocked) {
      await db.update(heldMerges).set({ resolvedAt: new Date() }).where(eq(heldMerges.id, h.id));
    }
  }
}

export async function getHeldMerge(db: Db, id: string) {
  await closeStaleHolds(db);
  await closeStaleByDetection(db);
  const row = await db.query.heldMerges.findFirst({
    where: and(eq(heldMerges.id, id), isNull(heldMerges.resolvedAt)),
  });
  if (!row) throw errors.heldMergeNotFound();
  return row;
}

/**
 * Feature 072 (FR-017): withdraw a held merge without merging and without changing anyone's access.
 *
 * A hold asks a question, and "leave them alone" is a legitimate answer. Before this, the only exits were
 * to resolve it — which needs the reason's authority — or to remove its cause, which changes somebody's
 * roles or accounts. Neither suits the ordinary case: the person working the queue tried a merge, it
 * stopped, and they decided not to pursue it.
 *
 * This needs only `dedup.write`, the authority to merge, because abandoning is non-destructive by
 * construction: a hold never wrote anything, so withdrawing it writes nothing back. It is deliberately
 * NOT a judgement that the pair are different people — that is a rejection, with its own record.
 */
export async function abandonHeldMerge(db: Db, id: string, actor: string): Promise<void> {
  const hold = await getHeldMerge(db, id);
  await db.update(heldMerges).set({ resolvedAt: new Date() }).where(eq(heldMerges.id, hold.id));
  await recordAudit(db, {
    kind: "dedup.merge_abandoned",
    actorContactId: actor,
    details: { heldMergeId: hold.id, reason: hold.reason },
  });
}

/**
 * Apply the choice and complete the merge (FR-012). The choice must actually answer the question the
 * hold asked — a surviving sign-in does not settle which membership account to keep — so a mismatched
 * one is refused rather than quietly ignored, which would leave the merge held for a reason nobody
 * could see from the response.
 */
export async function resolveHeldMerge(
  db: Db,
  id: string,
  choice: {
    survivingIdentityId?: string;
    survivingLoginEmailId?: string;
    survivingAccountId?: string;
    keepGrantIds?: string[];
  },
  actor: string,
): Promise<MergeOutcome> {
  const hold = await getHeldMerge(db, id);

  // The choice must answer the question actually asked. A grant list does not settle which account
  // survives, and an account id does not settle who may assign roles.
  const answered =
    hold.reason === "two_logins"
      ? // FR-012a: the address is a label; the identity is what grants access. Naming the address while
        // leaving the binding untouched settles nothing — which is exactly what feature 069 did.
        //
        // But require the binding only when one EXISTS. A login address may be designated before the
        // person has ever signed in, in which case there is no binding to leave untouched and the label
        // is the whole of the sign-in. Demanding an identity there would make the hold unresolvable.
        !!choice.survivingLoginEmailId &&
        (!(await pairHasIdentity(db, hold.canonicalId, hold.mergedId)) ||
          !!choice.survivingIdentityId)
      : hold.reason === "two_accounts"
        ? !!choice.survivingAccountId
        : !!choice.keepGrantIds;
  if (!answered) throw errors.heldMergeReasonMismatch(hold.reason);

  // The chosen thing must belong to one of the two contacts — otherwise the "choice" resolves nothing.
  if (hold.reason === "role_conflict") {
    // Every named grant must belong to the contact being merged — naming one of the survivor's own, or
    // a stranger's, would not resolve anything.
    for (const grantId of choice.keepGrantIds!) {
      const g = await db.query.roleGrants.findFirst({ where: eq(roleGrants.id, grantId) });
      if (!g || g.contactId !== hold.mergedId) throw errors.heldMergeReasonMismatch(hold.reason);
    }
  } else if (hold.reason === "two_logins") {
    const email = await db.query.contactEmails.findFirst({
      where: eq(contactEmails.id, choice.survivingLoginEmailId!),
    });
    if (!email || ![hold.canonicalId, hold.mergedId].includes(email.contactId)) {
      throw errors.heldMergeReasonMismatch(hold.reason);
    }
  } else {
    const account = await db.query.membershipAccounts.findFirst({
      where: eq(membershipAccounts.id, choice.survivingAccountId!),
    });
    if (!account || ![hold.canonicalId, hold.mergedId].includes(account.payerContactId)) {
      throw errors.heldMergeReasonMismatch(hold.reason);
    }
  }

  const outcome = await mergeContacts(db, hold.canonicalId, hold.mergedId, actor, choice);
  if (outcome.outcome === "completed") {
    await db.update(heldMerges).set({ resolvedAt: new Date() }).where(eq(heldMerges.id, hold.id));
    await recordAudit(db, {
      kind: "dedup.merge_resolved",
      actorContactId: actor,
      details: { heldMergeId: hold.id, reason: hold.reason },
    });
  }
  return outcome;
}
