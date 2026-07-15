import { eq } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import { contactEmails, contacts, memberships, mergeAudit, payers } from "@/server/db/schema";
import { errors } from "@/server/lib/apiError";
import { writeAudit } from "@/server/lib/audit";
import { recomputeContactStatus } from "@/server/domain/membership/membershipService";

export type MergeResult = {
  canonicalId: string;
  relinkedCounts: Record<string, number>;
};

/**
 * Admin-confirmed, transactional merge (no automatic merges). Re-links all
 * related records from the merged contact to the canonical one, soft-retires the
 * merged contact via merged_into_id, recomputes the canonical status, and writes
 * an append-only merge audit row.
 */
export async function mergeContacts(
  db: Db,
  canonicalId: string,
  mergedId: string,
  actor: string,
): Promise<MergeResult> {
  if (canonicalId === mergedId) throw errors.sameContact();

  return db.transaction(async (tx) => {
    const canonical = await tx.query.contacts.findFirst({ where: eq(contacts.id, canonicalId) });
    const merged = await tx.query.contacts.findFirst({ where: eq(contacts.id, mergedId) });
    if (!canonical || !merged) throw errors.contactNotFound();
    if (canonical.mergedIntoId !== null || merged.mergedIntoId !== null) {
      throw errors.alreadyMerged();
    }

    const relinkedEmails = await tx
      .update(contactEmails)
      .set({ contactId: canonicalId })
      .where(eq(contactEmails.contactId, mergedId))
      .returning({ id: contactEmails.id });

    const relinkedMemberships = await tx
      .update(memberships)
      .set({ contactId: canonicalId })
      .where(eq(memberships.contactId, mergedId))
      .returning({ id: memberships.id });

    const relinkedPayers = await tx
      .update(payers)
      .set({ contactId: canonicalId })
      .where(eq(payers.contactId, mergedId))
      .returning({ id: payers.id });

    // Soft-retire the merged contact (preserves audit trail / reversibility).
    await tx
      .update(contacts)
      .set({ mergedIntoId: canonicalId, updatedAt: new Date() })
      .where(eq(contacts.id, mergedId));

    // Canonical may have gained memberships → recompute its status.
    await recomputeContactStatus(tx, canonicalId, "membership_change", actor);

    const relinkedCounts = {
      contact_emails: relinkedEmails.length,
      memberships: relinkedMemberships.length,
      payers: relinkedPayers.length,
    };

    await tx.insert(mergeAudit).values({ canonicalId, mergedId, actor, relinkedCounts });
    writeAudit({
      kind: "contact.merge",
      actor,
      details: { canonicalId, mergedId, relinkedCounts },
    });

    return { canonicalId, relinkedCounts };
  });
}
