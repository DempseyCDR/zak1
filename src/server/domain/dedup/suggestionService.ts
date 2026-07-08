import { sql } from "drizzle-orm";
import type { Db } from "@/server/db/client";

export type MergeSuggestion = {
  a: { id: string; displayName: string; membershipStatus: string };
  b: { id: string; displayName: string; membershipStatus: string };
  similarity: number;
};

/**
 * Surface likely-duplicate contact pairs via pg_trgm similarity on the structured-name dedup key
 * (`dedup_normalized` = first+last), so a display-name override cannot mask a duplicate (feature 012).
 * Only non-merged contacts; each unordered pair appears once (a.id<b.id). Suggestions only — no merges.
 */
export async function getMergeSuggestions(
  db: Db,
  threshold = 0.4,
  limit = 50,
): Promise<MergeSuggestion[]> {
  const rows = await db.execute<{
    a_id: string;
    a_name: string;
    a_status: string;
    b_id: string;
    b_name: string;
    b_status: string;
    sim: number;
  }>(sql`
    SELECT a.id AS a_id, a.display_name AS a_name, a.membership_status AS a_status,
           b.id AS b_id, b.display_name AS b_name, b.membership_status AS b_status,
           similarity(a.dedup_normalized, b.dedup_normalized) AS sim
    FROM contacts a
    JOIN contacts b
      ON a.id < b.id
     AND a.merged_into_id IS NULL
     AND b.merged_into_id IS NULL
     AND a.dedup_normalized % b.dedup_normalized
    WHERE similarity(a.dedup_normalized, b.dedup_normalized) >= ${threshold}
    ORDER BY sim DESC
    LIMIT ${limit}
  `);

  return [...rows].map((r) => ({
    a: { id: r.a_id, displayName: r.a_name, membershipStatus: r.a_status },
    b: { id: r.b_id, displayName: r.b_name, membershipStatus: r.b_status },
    similarity: Number(r.sim),
  }));
}
