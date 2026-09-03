"use client";
import { apiFetch } from "@/app/apiFetch";
import { formatPhone } from "@/server/domain/contacts/phone";

import { useCallback, useEffect, useState } from "react";

// Feature 033 (P5-R7): each candidate carries phone (canonical, feature 032) + active emails so the reviewer
// can tell a real duplicate from a coincidental same-name match.
type Candidate = {
  id: string;
  displayName: string;
  membershipStatus: string;
  phone: string | null;
  emails: string[];
};
type Pair = { a: Candidate; b: Candidate; similarity: number };

type EmailRow = { id: string; email: string; status: string };
type Record = { id: string; displayName: string; emails: EmailRow[] };

/**
 * Feature 067 (FR-019): a pending "link as shared", held until Mel confirms.
 *
 * This queue pairs on NAME similarity and knows nothing about addresses, so a pair here is NOT evidence
 * of a household — the near-identical names that reach it (a father and son) are exactly where adopting
 * the wrong address is plausible. So the address being adopted is named, and anything being given up is
 * named, before the write happens.
 */
type PendingShare = {
  referrerId: string;
  referrerName: string;
  ownerName: string;
  emailId: string;
  address: string;
  retireEmailId?: string;
  retireAddress?: string;
};

const activeEmail = (r: Record | null): EmailRow | undefined =>
  r?.emails?.find((e) => e.status === "active");

export default function DedupPage() {
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingShare | null>(null);

  const load = useCallback(async () => {
    const res = await apiFetch("/api/dedup/suggestions");
    const data = await res.json();
    setPairs(data.pairs ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function merge(canonicalId: string, mergedId: string) {
    setMessage(null);
    const res = await apiFetch("/api/dedup/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ canonicalId, mergedId }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setMessage(body?.error?.message ?? "Merge failed");
      return;
    }
    const body = await res.json();
    setMessage(`Merged. Re-linked: ${JSON.stringify(body.relinkedCounts)}`);
    void load();
  }

  /** Stage a share: read both records so the confirmation can name the real addresses. */
  async function proposeShare(owner: Candidate, referrer: Candidate) {
    setMessage(null);
    const [ownerRec, referrerRec] = await Promise.all([
      apiFetch(`/api/contacts/${owner.id}`).then((r) => r.json() as Promise<Record>),
      apiFetch(`/api/contacts/${referrer.id}`).then((r) => r.json() as Promise<Record>),
    ]);
    const target = activeEmail(ownerRec);
    if (!target) {
      setMessage(`${owner.displayName} has no active address to share.`);
      return;
    }
    const own = activeEmail(referrerRec);
    setPending({
      referrerId: referrer.id,
      referrerName: referrer.displayName,
      ownerName: owner.displayName,
      emailId: target.id,
      address: target.email,
      ...(own ? { retireEmailId: own.id, retireAddress: own.email } : {}),
    });
  }

  async function confirmShare() {
    if (!pending) return;
    const res = await apiFetch(`/api/contacts/${pending.referrerId}/message-recipient`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        emailId: pending.emailId,
        ...(pending.retireEmailId ? { retireEmailId: pending.retireEmailId } : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setMessage(body?.error?.message ?? "Could not link the shared email");
      return;
    }
    setMessage(`${pending.referrerName} is now reached at ${pending.address}.`);
    setPending(null);
    void load();
  }

  return (
    <main style={{ padding: 24, maxWidth: 800 }}>
      <h1>Duplicate review queue</h1>
      <p style={{ color: "#666" }}>
        Confirm a merge to combine two contacts. Keep the contact on the left as canonical.
      </p>
      {message && <p>{message}</p>}
      {pairs.length === 0 && <p style={{ color: "#888" }}>No suggested duplicates</p>}
      <ul style={{ listStyle: "none", padding: 0 }}>
        {pairs.map((p) => (
          <li
            key={`${p.a.id}:${p.b.id}`}
            style={{ border: "1px solid #ddd", padding: 12, marginBottom: 8, borderRadius: 6 }}
          >
            <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
              <CandidateDetail c={p.a} />
              <span aria-hidden style={{ paddingTop: 4 }}>
                ⟷
              </span>
              <CandidateDetail c={p.b} />
            </div>
            <div style={{ marginTop: 4 }}>
              <em>similarity {p.similarity.toFixed(2)}</em>
            </div>
            <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
              <button onClick={() => merge(p.a.id, p.b.id)}>Keep left, merge right</button>
              <button onClick={() => merge(p.b.id, p.a.id)}>Keep right, merge left</button>
              {/* Feature 067 (M-R26): different people, one household address — not a merge. */}
              <button onClick={() => proposeShare(p.a, p.b)}>
                {`Share ${p.a.displayName}'s email`}
              </button>
              <button onClick={() => proposeShare(p.b, p.a)}>
                {`Share ${p.b.displayName}'s email`}
              </button>
            </div>
            {pending && (pending.referrerId === p.a.id || pending.referrerId === p.b.id) && (
              <div
                role="region"
                aria-label="Shared email confirmation"
                style={{ marginTop: 8, padding: 8, background: "#fff8e1", borderRadius: 4 }}
              >
                <p>
                  {pending.referrerName} will be reached at <strong>{pending.address}</strong> (
                  {pending.ownerName}&apos;s address). They stay separate contacts.
                </p>
                {pending.retireAddress && (
                  <p>
                    This retires {pending.referrerName}&apos;s own address{" "}
                    <strong>{pending.retireAddress}</strong>.
                  </p>
                )}
                <button onClick={confirmShare}>Confirm shared email</button>{" "}
                <button onClick={() => setPending(null)}>Cancel</button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}

// Feature 033: a candidate's name + membership status, plus phone (dashed via formatPhone) and active
// email(s) — a clear "no phone" / "no email" when absent, never a bare blank.
function CandidateDetail({ c }: { c: Candidate }) {
  return (
    <div style={{ minWidth: 200 }}>
      <div>
        <strong>{c.displayName}</strong> <small>({c.membershipStatus})</small>
      </div>
      <div style={{ color: c.phone ? "#333" : "#999" }}>
        <small>{c.phone ? formatPhone(c.phone) : "no phone"}</small>
      </div>
      <div style={{ color: c.emails.length ? "#333" : "#999" }}>
        <small>{c.emails.length ? c.emails.join(", ") : "no email"}</small>
      </div>
    </div>
  );
}
