"use client";
import { apiFetch } from "@/app/apiFetch";
import { EventSelector } from "@/app/EventSelector";

import { useCallback, useEffect, useState } from "react";

type Line = {
  category: string;
  class: string;
  cash: number;
  card: number;
  total: number;
};
type Report = {
  event: { id: string; date: string; seriesKey: string };
  gateSalesSummary: {
    customer: string;
    posVerification: { gross: number; fee: number };
    lines: Line[];
  };
  namedCustomerReceipts: {
    kind: string;
    contact: string;
    contactId: string | null;
    class: string;
    amount: number;
  }[];
  performerPayments: {
    payee: string;
    amount: number;
    class: string;
    checkNumber: string | null;
  }[];
  deposit: { amount: number };
  fees: { doorFee: number; onlineFee: number; total: number };
};

const money = (n: number) => `$${n.toFixed(2)}`;

// Feature 028 (P5-R1): the treasurer report is now a single `/treasurer` page with the shared event selector
// (in-page state — the event is no longer a `[eventId]` URL param; the old `/treasurer/latest` nav entry is
// fixed to point here). The selector defaults to the most recent event ≤ today; the report loads on select
// and reloads when the selected event changes.
export default function TreasurerReportPage() {
  const [eventId, setEventId] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!eventId) {
      setReport(null);
      setError(null);
      return;
    }
    setError(null);
    const r = await apiFetch(`/api/events/${eventId}/treasurer-report`);
    if (!r.ok) {
      setReport(null);
      setError((await r.json()).error?.message ?? "Failed");
      return;
    }
    setReport(await r.json());
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main style={{ padding: 24, maxWidth: 820 }}>
      <h1>Treasurer Report</h1>
      <EventSelector value={eventId} onSelect={(e) => setEventId(e.id)} />

      {error && <p role="alert">Error: {error}</p>}
      {!error && eventId && !report && <p>Loading…</p>}

      {report && (
        <>
          <h2>
            {report.event.date} ({report.event.seriesKey})
          </h2>

          <h2>Gate Sales Summary — {report.gateSalesSummary.customer}</h2>
          <p>
            Card verification: gross {money(report.gateSalesSummary.posVerification.gross)} · fee{" "}
            {money(report.gateSalesSummary.posVerification.fee)}
          </p>
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Class</th>
                <th>Cash</th>
                <th>Card</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {report.gateSalesSummary.lines.map((l) => (
                <tr key={l.category}>
                  <td>{l.category}</td>
                  <td>{l.class}</td>
                  <td>{money(l.cash)}</td>
                  <td>{money(l.card)}</td>
                  <td>{money(l.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2>Named-Customer Receipts</h2>
          <ul>
            {report.namedCustomerReceipts.map((r, i) => (
              <li key={`${r.kind}:${r.contactId ?? i}`}>
                {r.kind} — <strong>{r.contact}</strong> — {money(r.amount)} ({r.class})
              </li>
            ))}
            {report.namedCustomerReceipts.length === 0 && <li style={{ color: "#888" }}>None</li>}
          </ul>

          <h2>Performer Payments</h2>
          <table>
            <thead>
              <tr>
                <th>Payee</th>
                <th>Amount</th>
                <th>Class</th>
                <th>Check #</th>
              </tr>
            </thead>
            <tbody>
              {report.performerPayments.map((p, i) => (
                <tr key={i}>
                  <td>{p.payee}</td>
                  <td>{money(p.amount)}</td>
                  <td>{p.class}</td>
                  <td>{p.checkNumber ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2>Deposit</h2>
          <p>{money(report.deposit.amount)} → ESL Checking</p>

          <h2>Fees (informational)</h2>
          <p>
            Door {money(report.fees.doorFee)} · Online {money(report.fees.onlineFee)} · Total{" "}
            {money(report.fees.total)}
          </p>

          <button onClick={() => window.print()} style={{ marginTop: 16 }}>
            Print
          </button>
        </>
      )}
    </main>
  );
}
