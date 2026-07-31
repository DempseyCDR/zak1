"use client";
import { apiFetch } from "@/app/apiFetch";

import { useEffect, useState } from "react";

type EventRow = { id: string; eventDate: string };
type Candidate = { id: string; displayName: string };
type BookingLite = { id: string; performerName: string; performerType: string; status: string };

const ANON_CATEGORIES = ["merchandise", "gift_card", "misc_sales"] as const;
const NAMED_CATEGORIES = ["donation", "future_event", "membership"] as const;
type PaymentMethod = "cash" | "card";

type AnonAmounts = Record<string, { cash: string; card: string }>;
const emptyAnon: AnonAmounts = Object.fromEntries(
  ANON_CATEGORIES.map((c) => [c, { cash: "", card: "" }]),
);

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
  // Feature 019 US5: initialised empty; pre-filled from the door record's configured seed float on load.
  const [seedFloat, setSeedFloat] = useState("");
  const [cashPaidOut, setCashPaidOut] = useState("");
  const [cashPaidOutReason, setCashPaidOutReason] = useState("");
  const [compCount, setCompCount] = useState("");
  // Feature 017 (B29/B36): counts the Door Attendant captured at check-in; the FS confirms comp/gift
  // (editable) and sees the open-band comp count (read-only).
  const [giftCount, setGiftCount] = useState("");
  const [openBandCount, setOpenBandCount] = useState(0);
  const [deposit, setDeposit] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  // contact search for adding a named line
  const [search, setSearch] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [newCategory, setNewCategory] = useState<(typeof NAMED_CATEGORIES)[number]>("membership");

  // Feature 024 US3 (FR-008): the FS can substitute a performer on this event's booking from the gate — when
  // a booked player is a no-show and a check was already written, this keeps the no-show and books the sub.
  const [subBookings, setSubBookings] = useState<BookingLite[]>([]);
  const [subBookingId, setSubBookingId] = useState("");
  const [subQ, setSubQ] = useState("");
  const [subHits, setSubHits] = useState<Candidate[]>([]);
  const [subMsg, setSubMsg] = useState<string | null>(null);

  useEffect(() => {
    void apiFetch("/api/events")
      .then((r) => r.json())
      .then((d) => setEvents(d.items ?? []));
  }, []);

  useEffect(() => {
    if (!search.trim()) return setCandidates([]);
    void apiFetch(`/api/attendance/search?q=${encodeURIComponent(search)}`)
      .then((r) => r.json())
      .then((d) => setCandidates(d.items ?? []));
  }, [search]);

  // Feature 024: load the event's bookings so the FS can substitute one.
  useEffect(() => {
    if (!eventId) return setSubBookings([]);
    setSubBookingId("");
    void apiFetch(`/api/events/${eventId}/bookings`)
      .then((r) => r.json())
      .then((d) => setSubBookings(d.bookings ?? []));
  }, [eventId]);

  useEffect(() => {
    if (subQ.trim().length < 1) return setSubHits([]);
    void apiFetch(`/api/performers?q=${encodeURIComponent(subQ)}`)
      .then((r) => r.json())
      .then((d) => setSubHits(d.items ?? []));
  }, [subQ]);

  async function substitute(newPerformerId: string) {
    if (!subBookingId) return setSubMsg("Choose a booking to substitute");
    setSubMsg(null);
    const res = await apiFetch(`/api/bookings/${subBookingId}/substitute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPerformerId }),
    });
    if (res.status === 403) return setSubMsg("Not permitted to substitute for this event.");
    if (!res.ok) return setSubMsg("Could not substitute performer");
    setSubQ("");
    setSubHits([]);
    setSubMsg("Substitute recorded (the wrong check, if any, is voided/reissued separately).");
    const refreshed = await apiFetch(`/api/events/${eventId}/bookings`).then((r) => r.json());
    setSubBookings(refreshed.bookings ?? []);
  }

  async function openDoorRecord(selectedEventId: string) {
    setEventId(selectedEventId);
    setDoorRecordId("");
    setDeposit(null);
    setMessage(null);
    setAnon(JSON.parse(JSON.stringify(emptyAnon)));
    setNamed([]);
    if (!selectedEventId) return;
    const res = await apiFetch(`/api/events/${selectedEventId}/door-record`, { method: "POST" });
    if (!res.ok) return setMessage("Could not open door record");
    const data = await res.json();
    const dr = data.doorRecord;
    setDoorRecordId(dr.id);
    // Feature 019 US5: the seed float now comes from the door record (seeded from the series parameter,
    // FR-022), not a hard-coded 15. The FS can still override it for this record.
    setSeedFloat(String(dr.seedFloat ?? 15));
    // Pre-fill the counts the Door Attendant captured at check-in, for the FS to confirm (FR-015).
    setCompCount(String(dr.compCount ?? 0));
    setGiftCount(String(dr.giftCardRedemptionCount ?? 0));
    setOpenBandCount(dr.openBandCount ?? 0);
    // D2 (data-loss fix): reload the money the FS already entered — previously these stayed blank on a return
    // visit, and the next Save wrote the blanks (0 / replace-all) over the saved record. Show a stored value,
    // blank when zero/unset so the placeholders stay clean.
    const money = (v: number) => (v ? String(v) : "");
    setGrossCash(money(dr.grossCash ?? 0));
    setPcGross(money(dr.pcGross ?? 0));
    setPosTxns(money(dr.posTransactionCount ?? 0));
    setCashPaidOut(money(dr.cashPaidOut ?? 0));
    setCashPaidOutReason(dr.cashPaidOutReason ?? "");
    // D2: rebuild the anon + named sale lines from the persisted gate sales, so a re-save round-trips them
    // instead of wiping them (putGateSales is replace-all).
    const anonNext: AnonAmounts = JSON.parse(JSON.stringify(emptyAnon));
    const namedNext: NamedLine[] = [];
    for (const s of (data.gateSales ?? []) as {
      category: string;
      paymentMethod: PaymentMethod;
      amountCents: number;
      contactId: string | null;
      contactName: string | null;
    }[]) {
      const amount = String(s.amountCents / 100);
      if ((ANON_CATEGORIES as readonly string[]).includes(s.category)) {
        anonNext[s.category]![s.paymentMethod] = amount;
      } else if ((NAMED_CATEGORIES as readonly string[]).includes(s.category) && s.contactId) {
        namedNext.push({
          category: s.category as (typeof NAMED_CATEGORIES)[number],
          contactId: s.contactId,
          contactName: s.contactName ?? "(unknown)",
          amount,
          paymentMethod: s.paymentMethod,
        });
      }
    }
    setAnon(anonNext);
    setNamed(namedNext);
  }

  function setAnonAmt(cat: string, method: PaymentMethod, v: string) {
    setAnon((a) => ({ ...a, [cat]: { ...a[cat]!, [method]: v } }));
  }

  function addNamedLine(c: Candidate) {
    setNamed((lines) => [
      ...lines,
      {
        category: newCategory,
        contactId: c.id,
        contactName: c.displayName,
        amount: "",
        paymentMethod: "card",
      },
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
          ? [
              {
                category: l.category,
                paymentMethod: l.paymentMethod,
                amount: v,
                contactId: l.contactId,
              },
            ]
          : [];
      }),
    ];
    const gsRes = await apiFetch(`/api/door-records/${doorRecordId}/gate-sales`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sales }),
    });
    // Gate money is the Financial Secretary's to write (FR-020). A Door Attendant reaches this page and
    // reads it — money is not secret — but a save is refused server-side. Surface that plainly rather
    // than as a generic failure. (Proactively disabling the control belongs with US5's role-aware UI.)
    if (gsRes.status === 403) {
      return setMessage("Only the Financial Secretary may record gate money for this event.");
    }
    if (!gsRes.ok) return setMessage("Gate sales failed");
    // Feature 019 (B31): show which named contacts got a membership created/renewed by this save.
    const gsBody = await gsRes.json().catch(() => null);
    const enrolled: { displayName: string; expiryDate: string }[] = gsBody?.enrolled ?? [];

    const res = await apiFetch(`/api/door-records/${doorRecordId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        posTransactionCount: Number(posTxns) || 0,
        grossCash: Number(grossCash) || 0,
        pcGross: Number(pcGross) || 0,
        seedFloat: Number(seedFloat) || 0,
        cashPaidOut: Number(cashPaidOut) || 0,
        compCount: Number(compCount) || 0,
        giftCardRedemptionCount: Number(giftCount) || 0,
        ...(cashPaidOutReason ? { cashPaidOutReason } : {}),
      }),
    });
    if (res.status === 403) {
      return setMessage("Only the Financial Secretary may record gate money for this event.");
    }
    if (!res.ok) {
      const b = await res.json().catch(() => null);
      return setMessage(b?.error?.message ?? "Update failed");
    }
    const body = await res.json();
    setDeposit(body.deposit); // fee intentionally not returned
    if (enrolled.length > 0) {
      const who = enrolled.map((e) => `${e.displayName} (through ${e.expiryDate})`).join(", ");
      setMessage(`Saved. Membership recorded: ${who}`);
    } else {
      setMessage("Saved");
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 680 }}>
      <h1>Gate money</h1>
      <label>
        Event:{" "}
        <select value={eventId} onChange={(e) => void openDoorRecord(e.target.value)}>
          <option value="">— select —</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.eventDate}
            </option>
          ))}
        </select>
      </label>
      {doorRecordId && (
        <p style={{ color: "#666" }}>Door record open ({doorRecordId.slice(0, 8)}…)</p>
      )}

      <h2>Anonymous gate sales</h2>
      <table>
        <thead>
          <tr>
            <th>Category</th>
            <th>Cash</th>
            <th>Card</th>
          </tr>
        </thead>
        <tbody>
          {ANON_CATEGORIES.map((c) => (
            <tr key={c}>
              <td>{c}</td>
              <td>
                <input
                  value={anon[c]!.cash}
                  onChange={(e) => setAnonAmt(c, "cash", e.target.value)}
                />
              </td>
              <td>
                <input
                  value={anon[c]!.card}
                  onChange={(e) => setAnonAmt(c, "card", e.target.value)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Named-customer sales (donation / future event / membership)</h2>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <select
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value as typeof newCategory)}
        >
          {NAMED_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          placeholder="Find contact…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
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
            <button onClick={() => setNamed((lines) => lines.filter((_, idx) => idx !== i))}>
              remove
            </button>
          </li>
        ))}
      </ul>

      <h2>Cash &amp; card reconciliation</h2>
      <p style={{ color: "#666" }}>
        Admission is derived: gross cash − seed float − non-admission cash, and Card gross −
        non-admission card.
      </p>
      <div style={{ display: "grid", gap: 6, maxWidth: 360 }}>
        <label>
          Gross cash (total counted){" "}
          <input value={grossCash} onChange={(e) => setGrossCash(e.target.value)} />
        </label>
        <label>
          Card gross (total card){" "}
          <input value={pcGross} onChange={(e) => setPcGross(e.target.value)} />
        </label>
        <label>
          Card transactions <input value={posTxns} onChange={(e) => setPosTxns(e.target.value)} />
        </label>
        <label>
          Seed float <input value={seedFloat} onChange={(e) => setSeedFloat(e.target.value)} />
        </label>
        <label>
          Cash paid out{" "}
          <input value={cashPaidOut} onChange={(e) => setCashPaidOut(e.target.value)} />
        </label>
        <label>
          Payout reason{" "}
          <input value={cashPaidOutReason} onChange={(e) => setCashPaidOutReason(e.target.value)} />
        </label>
        <label>
          Comps (admitted free){" "}
          <input value={compCount} onChange={(e) => setCompCount(e.target.value)} />
        </label>
        <label>
          Gift cards redeemed{" "}
          <input value={giftCount} onChange={(e) => setGiftCount(e.target.value)} />
        </label>
        <p style={{ margin: "4px 0", color: "#555" }}>
          <small>
            Open-band comps (from check-in, read-only): <strong>{openBandCount}</strong> — added to
            comps when deriving paying dancers.
          </small>
        </p>
        <button onClick={save} disabled={!doorRecordId}>
          Save
        </button>
      </div>

      {eventId && (
        <section style={{ marginTop: 16, borderTop: "1px solid #eee", paddingTop: 8 }}>
          <h2>Substitute a performer</h2>
          <p style={{ color: "#666" }}>
            <small>
              A paid booking is kept as a no-show and the substitute is booked fresh. Void/reissue
              the check on the payments page.
            </small>
          </p>
          <label>
            Booking{" "}
            <select
              aria-label="Booking to substitute"
              value={subBookingId}
              onChange={(e) => setSubBookingId(e.target.value)}
            >
              <option value="">— select —</option>
              {subBookings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.performerName} ({b.performerType}, {b.status})
                </option>
              ))}
            </select>
          </label>{" "}
          <input
            aria-label="Substitute performer"
            placeholder="Find substitute…"
            value={subQ}
            onChange={(e) => setSubQ(e.target.value)}
          />
          {subHits.length > 0 && (
            <ul>
              {subHits.map((h) => (
                <li key={h.id}>
                  <button
                    type="button"
                    onClick={() => void substitute(h.id)}
                    disabled={!subBookingId}
                  >
                    Substitute in {h.displayName}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {subMsg && <p role="status">{subMsg}</p>}
        </section>
      )}

      {deposit !== null && (
        <p>
          <strong>Deposit:</strong> ${deposit.toFixed(2)}
        </p>
      )}
      {message && <p>{message}</p>}
    </main>
  );
}
