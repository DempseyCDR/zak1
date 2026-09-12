-- Feature 074: make a merge reversible. Two additive changes; nothing existing is altered or dropped.

/*
 * Everything needed to undo ONE merge (FR-001 to FR-004).
 *
 * `relinked_counts` next to this column has recorded how MUCH moved since feature 033 — counts, never
 * identifiers — which is why no merge has ever been reversible: nothing distinguished a row that moved
 * onto the survivor from a row the survivor always had. This column is that missing half.
 *
 * NULL is load-bearing. It means "this merge was recorded before feature 074", which is exactly the
 * FR-007 un-reversible signal, so there is deliberately NO backfill and NO default: the 36 merges already
 * on record stay un-reversible and say so, rather than being offered an undo that would fail. Adding a
 * default here would silently claim reversibility the manifest cannot deliver.
 */
ALTER TABLE merge_audit ADD COLUMN IF NOT EXISTS reversal_manifest jsonb;

/*
 * One row per undo (FR-021). Its EXISTENCE is the "already undone" fact (FR-010) — `merge_audit` stays
 * append-only, so an `undone_at` column over there was not an option (FR-006).
 *
 * The UNIQUE on merge_audit_id is load-bearing, not hygiene: checking "has this been undone?" and then
 * undoing it is a check-then-act race, and this constraint settles it. Two people undoing the same merge
 * at once means one INSERT wins and the other violates the constraint and is reported as already undone.
 * That is cheaper and harder to get wrong than an advisory lock or SELECT ... FOR UPDATE.
 */
CREATE TABLE IF NOT EXISTS merge_reversals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merge_audit_id uuid NOT NULL UNIQUE REFERENCES merge_audit(id),
  actor text NOT NULL,
  -- Per table, how many manifest entries were applied.
  restored_counts jsonb NOT NULL DEFAULT '{}',
  -- Every entry NOT applied, each with its reason (`gone`, `occupied`, `not_authorized`). An undo that
  -- skipped something must be able to say what and why (FR-018, FR-020) — a bare count would leave Mel
  -- unable to judge whether to repair it by hand.
  skipped jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- No separate index on merge_audit_id: the UNIQUE above already provides one, and that is also the only
-- way this table is ever looked up (the history view resolves reversals by merge).
