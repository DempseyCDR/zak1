"use client";

import { useCallback, useEffect, useState } from "react";

type Pair = {
  a: { id: string; displayName: string; membershipStatus: string };
  b: { id: string; displayName: string; membershipStatus: string };
  similarity: number;
};

export default function DedupPage() {
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/dedup/suggestions");
    const data = await res.json();
    setPairs(data.pairs ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function merge(canonicalId: string, mergedId: string) {
    setMessage(null);
    const res = await fetch("/api/dedup/merge", {
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
            <div>
              <strong>{p.a.displayName}</strong> ({p.a.membershipStatus}) ⟷{" "}
              <strong>{p.b.displayName}</strong> ({p.b.membershipStatus}) —{" "}
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
