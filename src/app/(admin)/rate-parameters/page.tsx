"use client";

import { useState } from "react";

export default function RateParametersPage() {
  const [kind, setKind] = useState("caller");
  const [amount, setAmount] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const res = await fetch("/api/rate-parameters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, amount: Number(amount), effectiveDate }),
    });
    if (!res.ok) {
      const b = await res.json().catch(() => null);
      setMessage(b?.error?.message ?? "Failed");
      return;
    }
    setAmount("");
    setEffectiveDate("");
    setMessage("Rate saved");
  }

  return (
    <main style={{ padding: 24, maxWidth: 480 }}>
      <h1>Standard pay rates</h1>
      <p style={{ color: "#666" }}>Effective-dated; bookings default to the rate in effect on the event date.</p>
      <form onSubmit={save} style={{ display: "grid", gap: 6 }}>
        <select value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="caller">Caller</option>
          <option value="sound_tech">Sound Tech</option>
        </select>
        <input placeholder="Amount (dollars)" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <input placeholder="Effective date (YYYY-MM-DD)" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
        <button type="submit">Save rate</button>
        {message && <p>{message}</p>}
      </form>
    </main>
  );
}
