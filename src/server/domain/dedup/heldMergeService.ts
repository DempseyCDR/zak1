import { and, eq, isNull, sql } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import { contactEmails, heldMerges, membershipAccounts } from "@/server/db/schema";
import { errors } from "@/server/lib/apiError";
import { recordAudit } from "@/server/lib/audit";
import { mergeContacts, type HeldMergeReasonAuthority, type MergeOutcome } from "./mergeService";

export type HeldMergeItem = {
  id: string;
  reason: "two_logins" | "two_accounts";
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
         OR (h.reason = 'two_logins' AND (
               SELECT COUNT(*) FROM contact_emails ce
                WHERE ce.contact_id IN (h.canonical_id, h.merged_id) AND ce.is_login) < 2)
         OR (h.reason = 'two_accounts' AND (
               SELECT COUNT(*) FROM membership_accounts ma
                WHERE ma.payer_contact_id IN (h.canonical_id, h.merged_id)) < 2)
       )
  `);
}

export async function listHeldMerges(db: Db): Promise<HeldMergeItem[]> {
  await closeStaleHolds(db);
  const rows = await db.execute<{
    id: string;
    reason: "two_logins" | "two_accounts";
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
export function authorityFor(reason: "two_logins" | "two_accounts"): HeldMergeReasonAuthority {
  return reason === "two_logins" ? "role.assign" : "dedup.write";
}

export async function getHeldMerge(db: Db, id: string) {
  await closeStaleHolds(db);
  const row = await db.query.heldMerges.findFirst({
    where: and(eq(heldMerges.id, id), isNull(heldMerges.resolvedAt)),
  });
  if (!row) throw errors.heldMergeNotFound();
  return row;
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
  choice: { survivingLoginEmailId?: string; survivingAccountId?: string },
  actor: string,
): Promise<MergeOutcome> {
  const hold = await getHeldMerge(db, id);

  const answered =
    hold.reason === "two_logins" ? !!choice.survivingLoginEmailId : !!choice.survivingAccountId;
  if (!answered) throw errors.heldMergeReasonMismatch(hold.reason);

  // The chosen thing must belong to one of the two contacts — otherwise the "choice" resolves nothing.
  if (hold.reason === "two_logins") {
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
