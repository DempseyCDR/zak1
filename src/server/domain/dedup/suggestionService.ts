import { sql } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import { normalizeName } from "@/server/domain/contacts/normalize";

/** Escape LIKE/ILIKE wildcards in a user needle (Postgres default '\' escape char). */
function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

// Feature 033 (P5-R7): each candidate also carries phone (canonical, feature 032) + ACTIVE emails, so the
// reviewer can tell a real duplicate from a coincidental same-name match.
export type MergeSuggestionContact = {
  id: string;
  displayName: string;
  membershipStatus: string;
  phone: string | null;
  emails: string[];
};
export type MergeSuggestion = {
  a: MergeSuggestionContact;
  b: MergeSuggestionContact;
  similarity: number;
};

/**
 * Surface likely-duplicate contact pairs via pg_trgm similarity on the structured-name dedup key
 * (`dedup_normalized` = first+last), so a display-name override cannot mask a duplicate (feature 012).
 * Only non-merged contacts; each unordered pair appears once (a.id<b.id). Suggestions only — no merges.
 *
 * Feature 062 (M-R4): an optional `q` scopes the pairs to those where a member's name matches the query
 * (hybrid — empty `q` is the global queue). Matched on both the display key and the structured-name key,
 * so a display-name override cannot hide a duplicate from the scoped view either.
 */
export async function getMergeSuggestions(
  db: Db,
  threshold = 0.4,
  limit = 50,
  q?: string,
): Promise<MergeSuggestion[]> {
  const needle = q?.trim() ? `%${escapeLike(normalizeName(q))}%` : null;
  const qFilter = needle
    ? sql` AND (a.name_normalized ILIKE ${needle} OR a.dedup_normalized ILIKE ${needle}
              OR b.name_normalized ILIKE ${needle} OR b.dedup_normalized ILIKE ${needle})`
    : sql``;
  const rows = await db.execute<{
    a_id: string;
    a_name: string;
    a_status: string;
    a_phone: string | null;
    a_emails: string[];
    b_id: string;
    b_name: string;
    b_status: string;
    b_phone: string | null;
    b_emails: string[];
    sim: number;
  }>(sql`
    SELECT a.id AS a_id, a.display_name AS a_name, a.membership_status AS a_status, a.phone AS a_phone,
           ARRAY(SELECT ce.email::text FROM contact_emails ce
                 WHERE ce.contact_id = a.id AND ce.status = 'active'
                 ORDER BY ce.is_login DESC, ce.created_at) AS a_emails,
           b.id AS b_id, b.display_name AS b_name, b.membership_status AS b_status, b.phone AS b_phone,
           ARRAY(SELECT ce.email::text FROM contact_emails ce
                 WHERE ce.contact_id = b.id AND ce.status = 'active'
                 ORDER BY ce.is_login DESC, ce.created_at) AS b_emails,
           similarity(a.dedup_normalized, b.dedup_normalized) AS sim
    FROM contacts a
    JOIN contacts b
      ON a.id < b.id
     AND a.merged_into_id IS NULL
     AND b.merged_into_id IS NULL
     AND a.archived_at IS NULL
     AND b.archived_at IS NULL
     AND a.dedup_normalized % b.dedup_normalized
    WHERE similarity(a.dedup_normalized, b.dedup_normalized) >= ${threshold}${qFilter}
    ORDER BY sim DESC
    LIMIT ${limit}
  `);

  return [...rows].map((r) => ({
    a: {
      id: r.a_id,
      displayName: r.a_name,
      membershipStatus: r.a_status,
      phone: r.a_phone,
      emails: r.a_emails ?? [],
    },
    b: {
      id: r.b_id,
      displayName: r.b_name,
      membershipStatus: r.b_status,
      phone: r.b_phone,
      emails: r.b_emails ?? [],
    },
    similarity: Number(r.sim),
  }));
}

/**
 * Feature 064: the global count of candidate duplicate pairs for the launcher button — the same join and
 * threshold as `getMergeSuggestions` (no query, no limit), so the count matches the global queue.
 */
export async function countMergeSuggestions(db: Db, threshold = 0.4): Promise<number> {
  const rows = await db.execute<{ n: number }>(sql`
    SELECT COUNT(*)::int AS n
    FROM contacts a
    JOIN contacts b
      ON a.id < b.id
     AND a.merged_into_id IS NULL
     AND b.merged_into_id IS NULL
     AND a.archived_at IS NULL
     AND b.archived_at IS NULL
     AND a.dedup_normalized % b.dedup_normalized
    WHERE similarity(a.dedup_normalized, b.dedup_normalized) >= ${threshold}
  `);
  return [...rows][0]?.n ?? 0;
}
