import { and, eq, sql } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import { contacts, dedupRejections } from "@/server/db/schema";
import { errors } from "@/server/lib/apiError";
import { recordAudit } from "@/server/lib/audit";

/**
 * Feature 069 (M-R18) — "these are not duplicates".
 *
 * The judgement is stored WITH the two names as they stood when it was made (FR-003a), and the pair is
 * suppressed only while both still match. That is deliberately not a flag someone must remember to clear:
 * the lapse falls out of comparing stored names to current ones, so it is correct through every path that
 * can rename a contact — including paths written after this feature. See the suppression join in
 * `suggestionService`, which does that comparison in the same query that proposes the pair.
 *
 * One unordered pair is one row: ids are normalised so (a,b) and (b,a) are the same rejection, matching
 * the `a.id < b.id` half-pair rule the suggestion query already uses.
 */
function order(x: string, y: string): [string, string] {
  return x < y ? [x, y] : [y, x];
}

export async function rejectPair(
  db: Db,
  contactAId: string,
  contactBId: string,
  actorContactId: string,
): Promise<void> {
  if (contactAId === contactBId) throw errors.sameContact();
  const [aId, bId] = order(contactAId, contactBId);

  await db.transaction(async (tx) => {
    const a = await tx.query.contacts.findFirst({ where: eq(contacts.id, aId) });
    const b = await tx.query.contacts.findFirst({ where: eq(contacts.id, bId) });
    if (!a || !b) throw errors.contactNotFound();

    // Idempotent, and re-recording refreshes the names — rejecting a pair whose rejection has lapsed
    // says "still not duplicates, at these names", which is the only sensible reading of the action.
    await tx
      .insert(dedupRejections)
      .values({
        contactAId: aId,
        contactBId: bId,
        aDedupNormalized: a.dedupNormalized,
        bDedupNormalized: b.dedupNormalized,
        rejectedBy: actorContactId,
      })
      .onConflictDoUpdate({
        target: [dedupRejections.contactAId, dedupRejections.contactBId],
        set: {
          aDedupNormalized: a.dedupNormalized,
          bDedupNormalized: b.dedupNormalized,
          rejectedBy: actorContactId,
          rejectedAt: sql`now()`,
        },
      });

    await recordAudit(tx, {
      kind: "dedup.pair_rejected",
      actorContactId,
      details: { contactAId: aId, contactBId: bId },
    });
  });
}

export async function unrejectPair(
  db: Db,
  contactAId: string,
  contactBId: string,
  actorContactId: string,
): Promise<void> {
  if (contactAId === contactBId) throw errors.sameContact();
  const [aId, bId] = order(contactAId, contactBId);

  await db.transaction(async (tx) => {
    await tx
      .delete(dedupRejections)
      .where(and(eq(dedupRejections.contactAId, aId), eq(dedupRejections.contactBId, bId)));
    await recordAudit(tx, {
      kind: "dedup.pair_unrejected",
      actorContactId,
      details: { contactAId: aId, contactBId: bId },
    });
  });
}
