"use client";

import { useCallback, useEffect, useState } from "react";

type Series = { id: string; key: string; name: string };
type Resolved = { seriesKey: string; kind: string; amount: number; effectiveDate: string } | null;

const KINDS = ["rent", "ongoing"] as const;

export default function ExpenseParametersPage() {
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [seriesKey, setSeriesKey] = useState("");
  const [kind, setKind] = useState<(typeof KINDS)[number]>("rent");
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("");
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
      `/api/expense-parameters?seriesKey=${seriesKey}&kind=${kind}&on=${effectiveDate}`,
    );
    const d = await r.json();
    setResolved(d.resolved);
  }, [seriesKey, kind, effectiveDate]);

  useEffect(() => {
    void loadResolved();
  }, [loadResolved]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const res = await fetch("/api/expense-parameters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        seriesKey,
        kind,
        amount: Number(amount),
        label: label.trim() || undefined,
        effectiveDate,
      }),
    });
    if (res.ok) {
      setMessage("Saved.");
      setAmount("");
      setLabel("");
      void loadResolved();
    } else {
      setMessage((await res.json()).error?.message ?? "Failed");
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 640 }}>
      <h1>Series expense parameters</h1>
      <p style={{ color: "#555" }}>
        Effective-dated rent and ongoing expenses used by the Organizer Report. A new entry supersedes
        earlier ones from its effective date forward.
      </p>

      <form onSubmit={submit} style={{ display: "grid", gap: 10, maxWidth: 360 }}>
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
        <label>
          Kind
          <br />
          <select value={kind} onChange={(e) => setKind(e.target.value as (typeof KINDS)[number])}>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        <label>
          Amount ($)
          <br />
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </label>
        <label>
          Label (optional)
          <br />
          <input value={label} onChange={(e) => setLabel(e.target.value)} />
        </label>
        <label>
          Effective date
          <br />
          <input
            type="date"
            value={effectiveDate}
            onChange={(e) => setEffectiveDate(e.target.value)}
            required
          />
        </label>
        <button type="submit">Save parameter</button>
      </form>

      {message && <p>{message}</p>}

      <h2>Currently in effect (on {effectiveDate})</h2>
      {resolved ? (
        <p>
          {resolved.kind}: <strong>${resolved.amount.toFixed(2)}</strong>
        </p>
      ) : (
        <p style={{ color: "#777" }}>No {kind} parameter in effect for this series/date.</p>
      )}
    </main>
  );
}
