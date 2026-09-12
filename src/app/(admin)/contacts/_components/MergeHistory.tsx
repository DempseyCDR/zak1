"use client";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/app/apiFetch";
import styles from "../contacts.module.css";

/**
 * Feature 074 (FR-026 to FR-028): the merges that produced this contact, and whether each can be undone.
 *
 * `merge_audit` was written from feature 033 onward and read by nothing — a merge left no visible trace
 * on the record it produced. An undo nobody can find is not an undo, so this block is half of the
 * safety net and the honesty about it is the other half: a merge recorded before feature 074 carries no
 * manifest, cannot be reversed, and therefore shows no button at all. Offering one that failed would
 * teach Mel the net is unreliable exactly when she needs to trust it.
 */
export type MergeHistoryItem = {
  mergeId: string;
  mergedContact: { id: string; displayName: string };
  /** The contact this merge actually went into — not always the one being viewed, in a chain. */
  intoContact: { id: string; displayName: string };
  direct: boolean;
  actor: string;
  mergedAt: string;
  ageDays: number;
  activitySince: number;
  verdict: "reversible" | "no_manifest" | "survivor_merged" | "contact_archived" | "already_undone";
  reason?: string;
  reversal: {
    actor: string;
    undoneAt: string;
    skipped: { kind: string; table: string; reason: string }[];
  } | null;
};

type UndoOutcome = {
  restored: Record<string, number>;
  skipped: { kind: string; table: string; reason: string }[];
};

/** How long ago, in the terms a person actually thinks in. */
function age(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 31) return `${days} days ago`;
  if (days < 365) return `${Math.round(days / 30)} months ago`;
  return `over a year ago`;
}

/** Turn a table name into something Mel reads, since the skip list names tables. */
const TABLE_LABEL: Record<string, string> = {
  contact_emails: "an email address",
  membership_accounts: "a membership account",
  membership_members: "a household membership",
  attendance: "a check-in",
  gate_sales: "a door sale",
  membership_captures: "a membership payment",
  performers: "a performer record",
  officers: "an officer seat",
  venues: "a venue landlord record",
  role_grants: "a staff role",
  staff_identities: "a staff sign-in",
};

const SKIP_REASON: Record<string, string> = {
  gone: "no longer exists",
  occupied: "its place is already taken",
  not_authorized: "needs role-assignment authority",
};

const describeSkip = (s: { table: string; reason: string }) =>
  `${TABLE_LABEL[s.table] ?? s.table} — ${SKIP_REASON[s.reason] ?? s.reason}`;

export default function MergeHistory({
  contactId,
  onChanged,
}: {
  contactId: string;
  onChanged: () => void | Promise<void>;
}) {
  const [items, setItems] = useState<MergeHistoryItem[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<UndoOutcome | null>(null);

  const load = useCallback(async () => {
    const res = await apiFetch(`/api/dedup/merges?contactId=${encodeURIComponent(contactId)}`);
    if (!res.ok) return setItems([]);
    const body = (await res.json()) as { merges: MergeHistoryItem[] };
    setItems(body.merges);
  }, [contactId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function undo(item: MergeHistoryItem) {
    setError(null);
    setOutcome(null);
    setBusy(item.mergeId);
    try {
      const res = await apiFetch(`/api/dedup/merges/${item.mergeId}/undo`, { method: "POST" });
      const body = (await res.json()) as UndoOutcome & { error?: { message?: string } };
      if (!res.ok) {
        setError(body.error?.message ?? "That merge could not be undone.");
        return;
      }
      setOutcome({ restored: body.restored, skipped: body.skipped });
      await load();
      await onChanged();
    } finally {
      setBusy(null);
    }
  }

  // Nothing was ever merged into this contact: the block would be an empty heading.
  if (items !== null && items.length === 0) return null;

  return (
    <section className={styles.mergeHistorySection} aria-label="Merge history">
      <h3 className={styles.emailHeading}>Merge history</h3>

      {items === null ? (
        <p className={styles.rowMeta}>Loading…</p>
      ) : (
        <ul className={styles.emailList}>
          {items.map((item) => (
            <li key={item.mergeId} className={styles.mergeHistoryRow}>
              <p className={styles.rowMeta}>
                <strong>{item.mergedContact.displayName}</strong> was merged into{" "}
                {/* An earlier merge in a chain went into a contact that has since been merged onward
                    into this one. Saying "into this contact" would be false, and it is the thing that
                    makes a chain comprehensible: you can see WHY the older one cannot be undone yet. */}
                {item.direct ? "this contact" : <strong>{item.intoContact.displayName}</strong>}{" "}
                {age(item.ageDays)}
                {item.activitySince > 0 && item.verdict === "reversible"
                  ? ` — ${item.activitySince} ${
                      item.activitySince === 1 ? "record has" : "records have"
                    } been added since`
                  : ""}
                .
              </p>

              {item.verdict === "reversible" ? (
                <button
                  type="button"
                  className={styles.dupButton}
                  disabled={busy === item.mergeId}
                  onClick={() => void undo(item)}
                >
                  {busy === item.mergeId ? "Undoing…" : "Undo this merge"}
                </button>
              ) : (
                // FR-028: every other verdict states its own reason and offers NO action. An undo
                // control that would fail is worse than none at all.
                <p className={styles.hint}>{item.reason}</p>
              )}

              {item.reversal && (
                <p className={styles.hint}>
                  Undone {new Date(item.reversal.undoneAt).toLocaleDateString()}
                  {item.reversal.skipped.length > 0
                    ? `, with ${item.reversal.skipped.length} thing${
                        item.reversal.skipped.length === 1 ? "" : "s"
                      } that could not be put back`
                    : ""}
                  .
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* FR-018/FR-020: a reversal that skipped something is NOT a clean success, and must not read like
          one. Feature 072 shipped exactly that bug when a held merge was reported as completed. */}
      {outcome &&
        (outcome.skipped.length === 0 ? (
          <p className={styles.rowMeta}>Merge undone. Everything was put back.</p>
        ) : (
          <div className={styles.mergeHistoryNotice}>
            <p className={styles.warning}>
              Merge undone, but {outcome.skipped.length} thing
              {outcome.skipped.length === 1 ? "" : "s"} could not be put back:
            </p>
            <ul className={styles.sharedNames}>
              {outcome.skipped.map((s, i) => (
                <li key={`${s.table}-${i}`} className={styles.rowMeta}>
                  {describeSkip(s)}
                </li>
              ))}
            </ul>
            {outcome.skipped.some((s) => s.reason === "not_authorized") && (
              <p className={styles.hint}>
                A Vice-President, President or Super-user can complete the sign-in part.
              </p>
            )}
          </div>
        ))}

      {error && <p className={styles.error}>{error}</p>}
    </section>
  );
}
