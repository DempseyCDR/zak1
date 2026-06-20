"use client";

import { useState } from "react";

const CATEGORIES = [
  "today_admission",
  "merchandise",
  "donation",
  "future_event",
  "membership",
  "gift_card",
  "misc_sales",
] as const;

type Amounts = Record<string, { cash: string; card: string }>;

const emptyAmounts: Amounts = Object.fromEntries(
  CATEGORIES.map((c) => [c, { cash: "", card: "" }]),
);

export default function GatePage() {
  const [doorRecordId, setDoorRecordId] = useState("");
  const [amounts, setAmounts] = useState<Amounts>(emptyAmounts);
  const [posTxns, setPosTxns] = useState("");
  const [posGross, setPosGross] = useState("");
  const [grossCash, setGrossCash] = useState("");
  const [seedFloat, setSeedFloat] = useState("15");
  const [cashPaidOut, setCashPaidOut] = useState("");
  const [cashPaidOutReason, setCashPaidOutReason] = useState("");
  const [deposit, setDeposit] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function setAmt(cat: string, method: "cash" | "card", v: string) {
    setAmounts((a) => ({ ...a, [cat]: { ...a[cat]!, [method]: v } }));
  }

  async function save() {
    setMessage(null);
    const sales = CATEGORIES.flatMap((c) =>
      (["cash", "card"] as const).flatMap((m) => {
        const v = Number(amounts[c]![m]);
        return v > 0 ? [{ category: c, paymentMethod: m, amount: v }] : [];
      }),
    );
    const gsRes = await fetch(`/api/door-records/${doorRecordId}/gate-sales`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sales }),
    });
    if (!gsRes.ok) return setMessage("Gate sales failed");

    const res = await fetch(`/api/door-records/${doorRecordId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        posTransactionCount: Number(posTxns) || 0,
        posGross: Number(posGross) || 0,
        grossCash: Number(grossCash) || 0,
        seedFloat: Number(seedFloat) || 0,
        cashPaidOut: Number(cashPaidOut) || 0,
        ...(cashPaidOutReason ? { cashPaidOutReason } : {}),
      }),
    });
    if (!res.ok) {
      const b = await res.json().catch(() => null);
      return setMessage(b?.error?.message ?? "Update failed");
    }
    const body = await res.json();
    setDeposit(body.deposit); // note: fee is intentionally not returned
    setMessage("Saved");
  }

  return (
    <main style={{ padding: 24, maxWidth: 640 }}>
      <h1>Gate money</h1>
      <input
        placeholder="Door record id"
        value={doorRecordId}
        onChange={(e) => setDoorRecordId(e.target.value)}
        style={{ padding: 8, width: "100%" }}
      />

      <h2>Gate sales</h2>
      <table>
        <thead>
          <tr><th>Category</th><th>Cash</th><th>Card</th></tr>
        </thead>
        <tbody>
          {CATEGORIES.map((c) => (
            <tr key={c}>
              <td>{c}</td>
              <td><input value={amounts[c]!.cash} onChange={(e) => setAmt(c, "cash", e.target.value)} /></td>
              <td><input value={amounts[c]!.card} onChange={(e) => setAmt(c, "card", e.target.value)} /></td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Cash &amp; POS</h2>
      <div style={{ display: "grid", gap: 6, maxWidth: 360 }}>
        <label>POS txns <input value={posTxns} onChange={(e) => setPosTxns(e.target.value)} /></label>
        <label>POS gross <input value={posGross} onChange={(e) => setPosGross(e.target.value)} /></label>
        <label>Gross cash <input value={grossCash} onChange={(e) => setGrossCash(e.target.value)} /></label>
        <label>Seed float <input value={seedFloat} onChange={(e) => setSeedFloat(e.target.value)} /></label>
        <label>Cash paid out <input value={cashPaidOut} onChange={(e) => setCashPaidOut(e.target.value)} /></label>
        <label>Payout reason <input value={cashPaidOutReason} onChange={(e) => setCashPaidOutReason(e.target.value)} /></label>
        <button onClick={save}>Save</button>
      </div>

      {deposit !== null && <p><strong>Deposit:</strong> ${deposit.toFixed(2)}</p>}
      {message && <p>{message}</p>}
    </main>
  );
}
