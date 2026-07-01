"use client";

import { useEffect, useState } from "react";

type EventRow = { id: string; eventDate: string };
type Candidate = { id: string; displayName: string };
type CheckBooking = {
  id: string;
  performerId: string;
  performerType: string;
  payCents: number;
  requiresCheck: boolean;
  checkNumber: string | null;
};

const ANON_CATEGORIES = ["merchandise", "gift_card", "misc_sales"] as const;
const NAMED_CATEGORIES = ["donation", "future_event", "membership"] as const;
type PaymentMethod = "cash" | "card";

type AnonAmounts = Record<string, { cash: string; card: string }>;
const emptyAnon: AnonAmounts = Object.fromEntries(ANON_CATEGORIES.map((c) => [c, { cash: "", card: "" }]));

type NamedLine = {
  category: (typeof NAMED_CATEGORIES)[number];
  contactId: string;
  contactName: string;
  amount: string;
  paymentMethod: PaymentMethod;
};

export default function GatePage() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [eventId, setEventId] = useState("");
  const [doorRecordId, setDoorRecordId] = useState("");
  const [anon, setAnon] = useState<AnonAmounts>(emptyAnon);
  const [named, setNamed] = useState<NamedLine[]>([]);
  const [posTxns, setPosTxns] = useState("");
  const [grossCash, setGrossCash] = useState("");
  const [pcGross, setPcGross] = useState("");
  const [seedFloat, setSeedFloat] = useState("15");
  const [cashPaidOut, setCashPaidOut] = useState("");
  const [cashPaidOutReason, setCashPaidOutReason] = useState("");
  const [deposit, setDeposit] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  // contact search for adding a named line
  const [search, setSearch] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [newCategory, setNewCategory] = useState<(typeof NAMED_CATEGORIES)[number]>("membership");
  // performer checks (numbers known only after the event)
  const [checkBookings, setCheckBookings] = useState<CheckBooking[]>([]);
  const [performerNames, setPerformerNames] = useState<Record<string, string>>({});
  const [checkInputs, setCheckInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    void fetch("/api/events").then((r) => r.json()).then((d) => setEvents(d.items ?? []));
    void fetch("/api/performers")
      .then((r) => r.json())
      .then((d) => {
        const m: Record<string, string> = {};
        for (const p of (d.items ?? []) as { id: string; displayName: string }[]) m[p.id] = p.displayName;
        setPerformerNames(m);
      });
  }, []);

  useEffect(() => {
    if (!search.trim()) return setCandidates([]);
    void fetch(`/api/attendance/search?q=${encodeURIComponent(search)}`)
      .then((r) => r.json())
      .then((d) => setCandidates(d.items ?? []));
  }, [search]);

  async function openDoorRecord(selectedEventId: string) {
    setEventId(selectedEventId);
    setDoorRecordId("");
    setDeposit(null);
    setMessage(null);
    setAnon(JSON.parse(JSON.stringify(emptyAnon)));
    setNamed([]);
    setCheckBookings([]);
    setCheckInputs({});
    if (!selectedEventId) return;
    const res = await fetch(`/api/events/${selectedEventId}/door-record`, { method: "POST" });
    if (!res.ok) return setMessage("Could not open door record");
    const data = await res.json();
    setDoorRecordId(data.doorRecord.id);

    // Load this event's bookings that need a check, for check-number entry.
    const bRes = await fetch(`/api/events/${selectedEventId}/bookings`);
    if (bRes.ok) {
      const bd = await bRes.json();
      const needChecks = ((bd.bookings ?? []) as CheckBooking[]).filter((b) => b.requiresCheck);
      setCheckBookings(needChecks);
      setCheckInputs(Object.fromEntries(needChecks.map((b) => [b.id, b.checkNumber ?? ""])));
    }
  }

  async function saveCheck(bookingId: string) {
    const value = checkInputs[bookingId]?.trim() ?? "";
    const res = await fetch(`/api/bookings/${bookingId}/check`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkNumber: value || null }),
    });
    setMessage(res.ok ? "Check number saved" : "Failed to save check number");
  }

  function setAnonAmt(cat: string, method: PaymentMethod, v: string) {
    setAnon((a) => ({ ...a, [cat]: { ...a[cat]!, [method]: v } }));
  }

  function addNamedLine(c: Candidate) {
    setNamed((lines) => [
      ...lines,
      { category: newCategory, contactId: c.id, contactName: c.displayName, amount: "", paymentMethod: "card" },
    ]);
    setSearch("");
    setCandidates([]);
  }

  function setNamedField(i: number, patch: Partial<NamedLine>) {
    setNamed((lines) => lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  async function save() {
    setMessage(null);
    const sales = [
      ...ANON_CATEGORIES.flatMap((c) =>
        (["cash", "card"] as const).flatMap((m) => {
          const v = Number(anon[c]![m]);
          return v > 0 ? [{ category: c, paymentMethod: m, amount: v }] : [];
        }),
      ),
      ...named.flatMap((l) => {
        const v = Number(l.amount);
        return v > 0
          ? [{ category: l.category, paymentMethod: l.paymentMethod, amount: v, contactId: l.contactId }]
          : [];
      }),
    ];
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
        grossCash: Number(grossCash) || 0,
        pcGross: Number(pcGross) || 0,
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
    setDeposit(body.deposit); // fee intentionally not returned
    setMessage("Saved");
  }

  return (
    <main style={{ padding: 24, maxWidth: 680 }}>
      <h1>Gate money</h1>
      <label>
        Event:{" "}
        <select value={eventId} onChange={(e) => void openDoorRecord(e.target.value)}>
          <option value="">— select —</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>{e.eventDate}</option>
          ))}
        </select>
      </label>
      {doorRecordId && <p style={{ color: "#666" }}>Door record open ({doorRecordId.slice(0, 8)}…)</p>}

      <h2>Anonymous gate sales</h2>
      <table>
        <thead><tr><th>Category</th><th>Cash</th><th>Card</th></tr></thead>
        <tbody>
          {ANON_CATEGORIES.map((c) => (
            <tr key={c}>
              <td>{c}</td>
              <td><input value={anon[c]!.cash} onChange={(e) => setAnonAmt(c, "cash", e.target.value)} /></td>
              <td><input value={anon[c]!.card} onChange={(e) => setAnonAmt(c, "card", e.target.value)} /></td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Named-customer sales (donation / future event / membership)</h2>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <select value={newCategory} onChange={(e) => setNewCategory(e.target.value as typeof newCategory)}>
          {NAMED_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <input placeholder="Find contact…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {candidates.length > 0 && (
        <ul>
          {candidates.map((c) => (
            <li key={c.id}>
              {c.displayName} <button onClick={() => addNamedLine(c)}>add</button>
            </li>
          ))}
        </ul>
      )}
      <ul style={{ listStyle: "none", padding: 0 }}>
        {named.map((l, i) => (
          <li key={i} style={{ marginBottom: 4 }}>
            {l.category} — {l.contactName}{" "}
            <input
              placeholder="amount"
              value={l.amount}
              onChange={(e) => setNamedField(i, { amount: e.target.value })}
              style={{ width: 80 }}
            />{" "}
            <select
              value={l.paymentMethod}
              onChange={(e) => setNamedField(i, { paymentMethod: e.target.value as PaymentMethod })}
            >
              <option value="cash">cash</option>
              <option value="card">card</option>
            </select>{" "}
            <button onClick={() => setNamed((lines) => lines.filter((_, idx) => idx !== i))}>remove</button>
          </li>
        ))}
      </ul>

      <h2>Performer checks</h2>
      {checkBookings.length === 0 ? (
        <p style={{ color: "#888" }}>No performer payments require a check for this event.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {checkBookings.map((b) => (
            <li key={b.id} style={{ marginBottom: 4 }}>
              {performerNames[b.performerId] ?? b.performerType} ({b.performerType}) — $
              {(b.payCents / 100).toFixed(2)} — check #{" "}
              <input
                value={checkInputs[b.id] ?? ""}
                onChange={(e) => setCheckInputs((s) => ({ ...s, [b.id]: e.target.value }))}
                style={{ width: 100 }}
              />{" "}
              <button onClick={() => saveCheck(b.id)}>Save</button>
            </li>
          ))}
        </ul>
      )}

      <h2>Cash &amp; card reconciliation</h2>
      <p style={{ color: "#666" }}>Admission is derived: gross cash − seed float − non-admission cash, and Card gross − non-admission card.</p>
      <div style={{ display: "grid", gap: 6, maxWidth: 360 }}>
        <label>Gross cash (total counted) <input value={grossCash} onChange={(e) => setGrossCash(e.target.value)} /></label>
        <label>Card gross (total card) <input value={pcGross} onChange={(e) => setPcGross(e.target.value)} /></label>
        <label>Card transactions <input value={posTxns} onChange={(e) => setPosTxns(e.target.value)} /></label>
        <label>Seed float <input value={seedFloat} onChange={(e) => setSeedFloat(e.target.value)} /></label>
        <label>Cash paid out <input value={cashPaidOut} onChange={(e) => setCashPaidOut(e.target.value)} /></label>
        <label>Payout reason <input value={cashPaidOutReason} onChange={(e) => setCashPaidOutReason(e.target.value)} /></label>
        <button onClick={save} disabled={!doorRecordId}>Save</button>
      </div>

      {deposit !== null && <p><strong>Deposit:</strong> ${deposit.toFixed(2)}</p>}
      {message && <p>{message}</p>}
    </main>
  );
}
