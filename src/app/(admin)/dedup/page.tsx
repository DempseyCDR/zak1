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

export default function DedupPage() {
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [message, setMessage] = useState<string | null>(null);

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
            </div>
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
