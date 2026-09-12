import { eq, sql } from "drizzle-orm";
import type { Db, DbOrTx } from "@/server/db/client";
import { contacts, mergeReversals } from "@/server/db/schema";
import { errors } from "@/server/lib/apiError";
import { writeAudit } from "@/server/lib/audit";
import { recomputeContactStatus } from "@/server/domain/membership/membershipService";
import { reversibilityOf } from "./mergeHistoryService";
import type { ManifestEntry, RowKey, SkipReason, SkippedEntry } from "./mergeManifest";

/**
 * Feature 074, User Story 1 (FR-012 to FR-025): reverse a completed merge.
 *
 * Reads the manifest the merge wrote and replays it backwards. Nothing here infers anything — an undo
 * can only put back what the merge recorded, which is why merges predating this feature are refused
 * outright rather than half-reversed.
 */

/** What the actor is allowed to do. Only the sign-in portion needs more than `dedup.write` (FR-024). */
export type UndoAuthority = {
  /** Whether the actor holds `role.assign`. Gates every `accessChanging` entry. */
  canAssignRoles: boolean;
};

export type UndoResult = {
  mergeId: string;
  restoredContactId: string;
  /** Per table, how many entries were applied. */
  restored: Record<string, number>;
  /** Every entry that was not applied, and why (FR-018, FR-020). */
  skipped: SkippedEntry[];
};

/** Postgres error codes we treat as an expected, reportable skip rather than a failure. */
const UNIQUE_VIOLATION = "23505";
const FK_VIOLATION = "23503";

function constraintSkip(error: unknown): SkipReason | null {
  const code = (error as { code?: unknown } | null)?.code;
  // Its position is taken — the person was checked in to that event again after the merge, say.
  if (code === UNIQUE_VIOLATION) return "occupied";
  // What it hung off is gone — the event, or the account, was deleted after the merge.
  if (code === FK_VIOLATION) return "gone";
  return null;
}

/** `WHERE a = … AND b = …` over a recorded key. Column names come from our own manifest, never input. */
const whereKey = (key: RowKey) =>
  sql.join(
    Object.entries(key).map(([column, value]) => sql`${sql.identifier(column)} = ${value}`),
    sql` AND `,
  );

/**
 * Apply one entry inside a SAVEPOINT.
 *
 * The savepoint is what makes FR-018 and FR-019 coexist. A constraint violation in Postgres poisons the
 * whole transaction, so without one an entry whose slot is occupied would abort the entire reversal —
 * the opposite of best-effort. With one, the expected violations roll back just that entry and become a
 * reported skip, while anything unexpected still propagates and takes the whole undo with it.
 *
 * Returns the number of rows affected, or a skip reason.
 */
async function applyEntry(
  tx: DbOrTx,
  entry: ManifestEntry,
): Promise<{ rows: number } | { skip: SkipReason }> {
  try {
    return await tx.transaction(async (sp) => {
      switch (entry.kind) {
        case "move": {
          // Put the row back on the contact it came from. The recorded key is the row's identity as it
          // stood after the merge, which is exactly what is in the database now.
          const rows = [
            ...(await sp.execute(sql`
              UPDATE ${sql.identifier(entry.table)}
                 SET ${sql.identifier(entry.column)} = ${entry.fromContactId}
               WHERE ${whereKey(entry.key)}
              RETURNING 1
            `)),
          ];
          return { rows: rows.length };
        }
        case "create": {
          // Remove a row the merge added. Zero rows affected is the desired end state already, not a
          // failure to restore anything, so it is not reported as a skip.
          const rows = [
            ...(await sp.execute(sql`
              DELETE FROM ${sql.identifier(entry.table)} WHERE ${whereKey(entry.key)} RETURNING 1
            `)),
          ];
          return { rows: rows.length };
        }
        case "destroy": {
          // Re-insert the row exactly as it was, its own primary key included, so anything that
          // referenced it refers to it again.
          const columns = Object.keys(entry.row);
          const rows = [
            ...(await sp.execute(sql`
              INSERT INTO ${sql.identifier(entry.table)} (${sql.join(
                columns.map((c) => sql.identifier(c)),
                sql`, `,
              )})
              VALUES (${sql.join(
                columns.map((c) => sql`${entry.row[c] ?? null}`),
                sql`, `,
              )})
              ON CONFLICT DO NOTHING
              RETURNING 1
            `)),
          ];
          // ON CONFLICT rather than catching the violation: a row already occupying that key is the
          // expected case, and letting the statement say so is cheaper than an exception.
          return rows.length === 0 ? { skip: "occupied" } : { rows: rows.length };
        }
        case "overwrite": {
          const rows = [
            ...(await sp.execute(sql`
              UPDATE ${sql.identifier(entry.table)}
                 SET ${sql.identifier(entry.column)} = ${entry.previousValue ?? null}
               WHERE ${whereKey(entry.key)}
              RETURNING 1
            `)),
          ];
          return { rows: rows.length };
        }
      }
    });
  } catch (error) {
    const skip = constraintSkip(error);
    if (skip) return { skip };
    // FR-019: anything we did not anticipate aborts the whole reversal rather than being swallowed.
    throw error;
  }
}

/**
 * FR-012 to FR-025. One transaction; all-or-nothing for unanticipated failure, best-effort per entry
 * for the conditions FR-018 names.
 *
 * ## The order below is load-bearing
 *
 * It looks arbitrary and is not. Two partial unique indexes make the obvious order abort:
 *
 *   - `contact_emails_one_login_per_contact` allows one sign-in address per contact, so restoring the
 *     `is_login` flag BEFORE the addresses move back would briefly leave two login addresses on the
 *     survivor.
 *   - `staff_identities.contact_id` is unique, so a deleted binding cannot be re-inserted until the
 *     moved one has left the survivor.
 *
 * Postgres cannot defer either (unique *indexes* are not deferrable), so moving first and restoring
 * flags last is the mechanism rather than a preference.
 *
 * `destroy` entries replay in REVERSE manifest order, which is what keeps parents ahead of children:
 * the merge snapshotted the cascade-lost household rows and then deleted their account, so reversing
 * that sequence re-inserts the account first. Replaying forwards would fail the foreign key.
 */
export async function undoMerge(
  db: Db,
  mergeId: string,
  actor: string,
  authority: UndoAuthority,
): Promise<UndoResult> {
  // Refuse before opening a transaction, so a refusal costs nothing and reads cleanly in the log.
  const precheck = await reversibilityOf(db, mergeId);
  if (precheck.verdict !== "reversible") {
    throw errors.mergeNotReversible(precheck.verdict, precheck.reason);
  }

  return db.transaction(async (tx) => {
    // Re-checked inside the transaction: a merge reversible a minute ago may not be one now, and the
    // UNIQUE on `merge_reversals.merge_audit_id` catches the rest of the race at commit time.
    const state = await reversibilityOf(tx, mergeId);
    if (state.verdict !== "reversible") {
      throw errors.mergeNotReversible(state.verdict, state.reason);
    }
    const { manifest, canonicalId, mergedId } = state;

    const restored: Record<string, number> = {};
    const skipped: SkippedEntry[] = [];

    const run = async (entry: ManifestEntry) => {
      // FR-024/FR-025: the gate is per entry. Missing role-assignment authority skips the sign-in
      // portion and reports it; it never refuses the reversal, because the rest is useful without it
      // and a skipped binding repairs itself on the next sign-in.
      if (entry.accessChanging && !authority.canAssignRoles) {
        skipped.push({
          kind: entry.kind,
          table: entry.table,
          key: entry.key,
          reason: "not_authorized",
        });
        return;
      }

      const outcome = await applyEntry(tx, entry);
      if ("skip" in outcome) {
        skipped.push({
          kind: entry.kind,
          table: entry.table,
          key: entry.key,
          reason: outcome.skip,
        });
        return;
      }
      if (outcome.rows === 0) {
        // The row was deleted after the merge. A `create` we were going to remove anyway is already in
        // the desired state, so only the others count as something we failed to restore.
        if (entry.kind !== "create") {
          skipped.push({ kind: entry.kind, table: entry.table, key: entry.key, reason: "gone" });
        }
        return;
      }
      restored[entry.table] = (restored[entry.table] ?? 0) + outcome.rows;
    };

    /**
     * A row the merge CREATED and then DESTROYED cancels out, and both entries must be dropped.
     *
     * This is not hypothetical — it is what the account fold does. Folding two households copies
     * `(surviving_account, merged_contact)` in, and the collision drop immediately deletes that same row
     * because the survivor is already on that account. The manifest faithfully records a `create` and a
     * `destroy` for one key.
     *
     * Replaying both would resurrect it: the create's DELETE finds nothing (already gone) and the
     * destroy's INSERT puts it back — leaving the survivor holding a household row that never existed
     * before the merge. Since the row did not exist before the merge and does not exist after it, the
     * correct reversal is to do nothing at all.
     */
    const keyOf = (e: ManifestEntry) =>
      `${e.table}|${Object.keys(e.key)
        .sort()
        .map((k) => `${k}=${e.key[k]}`)
        .join("&")}`;
    const createdKeys = new Set(manifest.entries.filter((e) => e.kind === "create").map(keyOf));
    const cancelled = new Set(
      manifest.entries.filter((e) => e.kind === "destroy" && createdKeys.has(keyOf(e))).map(keyOf),
    );

    const byKind = (kind: ManifestEntry["kind"]) =>
      manifest.entries.filter((e) => e.kind === kind && !cancelled.has(keyOf(e)));

    // 1. Everything the merge re-linked goes back where it came from (FR-013).
    for (const entry of byKind("move")) await run(entry);
    // 2. Rows the merge created are removed (FR-016) — before re-inserting, so nothing collides.
    for (const entry of byKind("create")) await run(entry);
    // 3. Rows the merge destroyed are recreated, parents first (FR-014). See the note above.
    for (const entry of byKind("destroy").reverse()) await run(entry);
    // 4. Overwritten fields last, once the rows they sit on are back on the right contact (FR-015).
    for (const entry of byKind("overwrite")) await run(entry);

    // 5. Bring the retired contact back to life. Its own fields were never touched by the merge, so
    //    clearing the pointer is the whole of it (FR-012).
    await tx
      .update(contacts)
      .set({ mergedIntoId: null, updatedAt: new Date() })
      .where(eq(contacts.id, mergedId));

    // 6. Both cached statuses (FR-017). BOTH: the survivor may have gained coverage from the merge that
    //    it no longer has, and the restored contact needs its own back. A stale cached status is
    //    invisible in the row-level data and has bitten this project repeatedly.
    await recomputeContactStatus(tx, canonicalId, "membership_change", actor);
    await recomputeContactStatus(tx, mergedId, "membership_change", actor);

    // FR-021. `merge_audit` is NOT touched — rewriting the record of a merge would erase the event it
    // exists to record (FR-006). The reversal is its own append-only row.
    await tx.insert(mergeReversals).values({
      mergeAuditId: mergeId,
      actor,
      restoredCounts: restored,
      skipped,
    });
    writeAudit({
      kind: "contact.merge.undone",
      actor,
      details: { mergeId, canonicalId, mergedId, restored, skipped },
    });

    return { mergeId, restoredContactId: mergedId, restored, skipped };
  });
}
