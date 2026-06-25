"use client";

import { use, useCallback, useEffect, useState } from "react";

type Line = { category: string; account: string; class: string; cash: number; card: number; total: number };
type Report = {
  event: { id: string; date: string; seriesKey: string };
  gateSalesSummary: { customer: string; posVerification: { gross: number; fee: number }; lines: Line[] };
  namedCustomerReceipts: {
    kind: string;
    contact: string;
    contactId: string | null;
    account: string;
    class: string;
    amount: number;
  }[];
  performerPayments: { payee: string; amount: number; account: string; class: string; checkNumber: string | null }[];
  deposit: { account: string; amount: number };
  fees: { account: string; doorFee: number; onlineFee: number; total: number };
  nonDanceIncome: { account: string; lines: { description: string; amount: number; date: string }[]; total: number };
};

const money = (n: number) => `$${n.toFixed(2)}`;

export default function TreasurerReportPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ndiDesc, setNdiDesc] = useState("");
  const [ndiAmount, setNdiAmount] = useState("");
  const [ndiDate, setNdiDate] = useState("");

  const load = useCallback(async () => {
    const r = await fetch(`/api/events/${eventId}/treasurer-report`);
    if (!r.ok) {
      setError((await r.json()).error?.message ?? "Failed");
      return;
    }
    setReport(await r.json());
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addNonDanceIncome(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/events/${eventId}/non-dance-income`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: ndiDesc, amount: Number(ndiAmount), entryDate: ndiDate }),
    });
    if (res.ok) {
      setNdiDesc("");
      setNdiAmount("");
      setNdiDate("");
      void load();
    }
  }

  if (error) return <main style={{ padding: 24 }}>Error: {error}</main>;
  if (!report) return <main style={{ padding: 24 }}>Loading…</main>;

  return (
    <main style={{ padding: 24, maxWidth: 820 }}>
      <h1>Treasurer Report — {report.event.date} ({report.event.seriesKey})</h1>

      <h2>Gate Sales Summary — {report.gateSalesSummary.customer}</h2>
      <p>POS verification: gross {money(report.gateSalesSummary.posVerification.gross)} · fee {money(report.gateSalesSummary.posVerification.fee)}</p>
      <table>
        <thead><tr><th>Category</th><th>Account</th><th>Class</th><th>Cash</th><th>Card</th><th>Total</th></tr></thead>
        <tbody>
          {report.gateSalesSummary.lines.map((l) => (
            <tr key={l.category}>
              <td>{l.category}</td><td>{l.account}</td><td>{l.class}</td>
              <td>{money(l.cash)}</td><td>{money(l.card)}</td><td>{money(l.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Named-Customer Receipts</h2>
      <ul>
        {report.namedCustomerReceipts.map((r, i) => (
          <li key={`${r.kind}:${r.contactId ?? i}`}>
            {r.kind} — <strong>{r.contact}</strong> — {money(r.amount)} → {r.account} ({r.class})
          </li>
        ))}
        {report.namedCustomerReceipts.length === 0 && <li style={{ color: "#888" }}>None</li>}
      </ul>

      <h2>Performer Payments</h2>
      <table>
        <thead><tr><th>Payee</th><th>Amount</th><th>Account</th><th>Class</th><th>Check #</th></tr></thead>
        <tbody>
          {report.performerPayments.map((p, i) => (
            <tr key={i}>
              <td>{p.payee}</td><td>{money(p.amount)}</td><td>{p.account}</td><td>{p.class}</td>
              <td>{p.checkNumber ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Deposit</h2>
      <p>{money(report.deposit.amount)} → {report.deposit.account} (ESL Checking)</p>

      <h2>Fees (informational)</h2>
      <p>Door {money(report.fees.doorFee)} · Online {money(report.fees.onlineFee)} · Total {money(report.fees.total)} → {report.fees.account}</p>

      <h2>Non-Dance Income</h2>
      <ul>
        {report.nonDanceIncome.lines.map((l, i) => (
          <li key={i}>{l.date} — {l.description}: {money(l.amount)}</li>
        ))}
        {report.nonDanceIncome.lines.length === 0 && <li style={{ color: "#888" }}>None</li>}
      </ul>
      <p>Total non-dance income: {money(report.nonDanceIncome.total)} → {report.nonDanceIncome.account}</p>
      <form onSubmit={addNonDanceIncome} style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <input placeholder="Description" value={ndiDesc} onChange={(e) => setNdiDesc(e.target.value)} />
        <input placeholder="Amount" value={ndiAmount} onChange={(e) => setNdiAmount(e.target.value)} style={{ width: 90 }} />
        <input type="date" value={ndiDate} onChange={(e) => setNdiDate(e.target.value)} />
        <button type="submit" disabled={!ndiDesc || !ndiAmount || !ndiDate}>Add non-dance income</button>
      </form>

      <button onClick={() => window.print()} style={{ marginTop: 16 }}>Print</button>
    </main>
  );
}
