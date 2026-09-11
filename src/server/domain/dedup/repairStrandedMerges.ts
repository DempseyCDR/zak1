import { sql } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import { UNCONDITIONAL_MOVES } from "./contactReferences";

export type RepairReport = Record<string, number>;

/**
 * Feature 072 (FR-015): re-point records that earlier merges left on a retired contact.
 *
 * Fixing the merge does not move rows it failed to move before, so the damage already done has to be
 * repaired explicitly — nine records on the club's data, including the six performers that are the reason
 * the Booker has no email link for them and the performer mailing list is short.
 *
 * ## Why this is a routine and not a migration
 *
 * The test database starts empty, so a backfill written as SQL inside a migration could never be
 * exercised against realistic input — it would ship untested, and the two properties below are precisely
 * the ones worth testing. Feature 068 made the same call for `migrateToAccounts` and recorded the same
 * reason; feature 070 deleted it once spent. Run once via `pnpm db:repair-merges`, then remove.
 *
 * ## The two properties
 *
 * **Follow the chain.** A contact may have been merged into a target that was itself later merged —
 * three such chains exist in the club's data. Moving one hop would leave the record pointing at another
 * retired contact, re-creating the condition being repaired. `final_survivor` walks `merged_into_id` to
 * a live contact.
 *
 * **Tolerate collisions.** The survivor may already hold what is being moved to them, exactly as in a
 * live merge, so the duplicate is dropped rather than violating a unique constraint.
 *
 * Records on an **archived** contact are excluded: archived means the person left the club, and there is
 * no survivor to move to.
 */
export async function repairStrandedMerges(db: Db): Promise<RepairReport> {
  const report: RepairReport = {};

  await db.transaction(async (tx) => {
    // Drop what would collide, using the same rule a live merge applies.
    await tx.execute(sql`
      WITH RECURSIVE chain AS (
        SELECT c.id AS stranded_id, c.merged_into_id AS next_id
          FROM contacts c WHERE c.merged_into_id IS NOT NULL
        UNION ALL
        SELECT ch.stranded_id, c.merged_into_id
          FROM chain ch JOIN contacts c ON c.id = ch.next_id
         WHERE c.merged_into_id IS NOT NULL
      ),
      final_survivor AS (
        SELECT ch.stranded_id, ch.next_id AS survivor_id
          FROM chain ch JOIN contacts s ON s.id = ch.next_id
         WHERE s.merged_into_id IS NULL
      )
      DELETE FROM membership_members m
       USING final_survivor f
       WHERE m.contact_id = f.stranded_id
         AND EXISTS (SELECT 1 FROM membership_members s
                      WHERE s.account_id = m.account_id AND s.contact_id = f.survivor_id)
    `);
    await tx.execute(sql`
      WITH RECURSIVE chain AS (
        SELECT c.id AS stranded_id, c.merged_into_id AS next_id
          FROM contacts c WHERE c.merged_into_id IS NOT NULL
        UNION ALL
        SELECT ch.stranded_id, c.merged_into_id
          FROM chain ch JOIN contacts c ON c.id = ch.next_id
         WHERE c.merged_into_id IS NOT NULL
      ),
      final_survivor AS (
        SELECT ch.stranded_id, ch.next_id AS survivor_id
          FROM chain ch JOIN contacts s ON s.id = ch.next_id
         WHERE s.merged_into_id IS NULL
      )
      DELETE FROM attendance a
       USING final_survivor f
       WHERE a.contact_id = f.stranded_id
         AND EXISTS (SELECT 1 FROM attendance s
                      WHERE s.event_id = a.event_id AND s.contact_id = f.survivor_id)
    `);

    // Then move, driven by the same classification the merge itself uses — so the repair and the merge
    // can never disagree about what belongs to a person.
    for (const ref of UNCONDITIONAL_MOVES) {
      const rows = await tx.execute(sql`
        WITH RECURSIVE chain AS (
          SELECT c.id AS stranded_id, c.merged_into_id AS next_id
            FROM contacts c WHERE c.merged_into_id IS NOT NULL
          UNION ALL
          SELECT ch.stranded_id, c.merged_into_id
            FROM chain ch JOIN contacts c ON c.id = ch.next_id
           WHERE c.merged_into_id IS NOT NULL
        ),
        final_survivor AS (
          SELECT ch.stranded_id, ch.next_id AS survivor_id
            FROM chain ch JOIN contacts s ON s.id = ch.next_id
           WHERE s.merged_into_id IS NULL
        )
        UPDATE ${sql.identifier(ref.table)} t
           SET ${sql.identifier(ref.column)} = f.survivor_id
          FROM final_survivor f
         WHERE t.${sql.identifier(ref.column)} = f.stranded_id
        RETURNING 1
      `);
      report[ref.table] = [...rows].length;
    }
  });

  return report;
}
