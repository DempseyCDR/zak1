"use client";

import { useCallback, useEffect, useState } from "react";

type Series = { id: string; key: string; name: string };
type Resolved = { seriesKey: string; kind: string; amount: number; effectiveDate: string } | null;

const KINDS = ["caller", "sound_tech", "musician"] as const;

export default function RateParametersPage() {
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [seriesKey, setSeriesKey] = useState("");
  const [kind, setKind] = useState<(typeof KINDS)[number]>("caller");
  const [amount, setAmount] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().slice(0, 10));
  const [resolved, setResolved] = useState<Resolved>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/series")
      .then((r) => r.json())
      .then((d: { items: Series[] }) => {
        setSeriesList(d.items);
        if (d.items[0]) setSeriesKey(d.items[0].key);
      });
  }, []);

  const loadResolved = useCallback(async () => {
    if (!seriesKey) return;
    const r = await fetch(
      `/api/rate-parameters?seriesKey=${seriesKey}&kind=${kind}&on=${effectiveDate}`,
    );
    const d = await r.json();
    setResolved(d.resolved);
  }, [seriesKey, kind, effectiveDate]);

  useEffect(() => {
    void loadResolved();
  }, [loadResolved]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const res = await fetch("/api/rate-parameters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seriesKey, kind, amount: Number(amount), effectiveDate }),
    });
    if (!res.ok) {
      const b = await res.json().catch(() => null);
      setMessage(b?.error?.message ?? "Failed");
      return;
    }
    setAmount("");
    setMessage("Rate saved");
    void loadResolved();
  }

  return (
    <main style={{ padding: 24, maxWidth: 480 }}>
      <h1>Standard pay rates</h1>
      <p style={{ color: "#666" }}>
        Effective-dated, per series; bookings default to the rate in effect on the event date.
      </p>
      <form onSubmit={save} style={{ display: "grid", gap: 6 }}>
        <label>
          Series
          <br />
          <select value={seriesKey} onChange={(e) => setSeriesKey(e.target.value)}>
            {seriesList.map((s) => (
              <option key={s.id} value={s.key}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <select value={kind} onChange={(e) => setKind(e.target.value as (typeof KINDS)[number])}>
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {k === "musician" ? "Musician (also used for Lead Musician)" : k}
            </option>
          ))}
        </select>
        <input
          placeholder="Amount (dollars)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <input
          type="date"
          value={effectiveDate}
          onChange={(e) => setEffectiveDate(e.target.value)}
        />
        <button type="submit">Save rate</button>
        {message && <p>{message}</p>}
      </form>

      <h2>Currently in effect (on {effectiveDate})</h2>
      {resolved ? (
        <p>
          {resolved.kind}: <strong>${resolved.amount.toFixed(2)}</strong>
        </p>
      ) : (
        <p style={{ color: "#777" }}>No {kind} rate in effect for this series/date.</p>
      )}
    </main>
  );
}
