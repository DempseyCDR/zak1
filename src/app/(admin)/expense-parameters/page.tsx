"use client";

import { useCallback, useEffect, useState } from "react";

type Series = { id: string; key: string; name: string };
type Resolved = { seriesKey: string; kind: string; amount: number; effectiveDate: string } | null;

// Feature 011: expense parameters are ongoing-only (rent moved to Venue rents). A series may carry
// several concurrent labeled charges; the label is the charge identity and is required.
export default function ExpenseParametersPage() {
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [seriesKey, setSeriesKey] = useState("");
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
      `/api/expense-parameters?seriesKey=${seriesKey}&kind=ongoing&on=${effectiveDate}`,
    );
    const d = await r.json();
    setResolved(d.resolved);
  }, [seriesKey, effectiveDate]);

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
        kind: "ongoing",
        amount: Number(amount),
        label: label.trim(),
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
      <h1>Ongoing series charges</h1>
      <p style={{ color: "#555" }}>
        Effective-dated recurring charges (e.g. supplies/insurance, an equipment loan) applied to
        every dance in a series. A series can carry several at once; end one by entering a $0 amount
        on its stop date. A new entry for the same label supersedes earlier ones. (Venue rent lives
        under Venue rents.)
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
          Charge label
          <br />
          <input value={label} onChange={(e) => setLabel(e.target.value)} required />
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
          Effective date
          <br />
          <input
            type="date"
            value={effectiveDate}
            onChange={(e) => setEffectiveDate(e.target.value)}
            required
          />
        </label>
        <button type="submit">Save charge</button>
      </form>

      {message && <p>{message}</p>}

      <h2>Total ongoing in effect (on {effectiveDate})</h2>
      {resolved ? (
        <p>
          <strong>${resolved.amount.toFixed(2)}</strong> across all charges
        </p>
      ) : (
        <p style={{ color: "#777" }}>No ongoing charges in effect for this series/date.</p>
      )}
    </main>
  );
}
