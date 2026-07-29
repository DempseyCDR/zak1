"use client";
import { apiFetch } from "@/app/apiFetch";

import { useCallback, useEffect, useState } from "react";

type EventRow = { id: string; eventDate: string };
type Performer = { id: string; displayName: string };
type Booking = { id: string; performerName: string; performerType: string; payCents: number };
type PaymentLine = { bookingId: string; amount: number };
type Payment = {
  id: string;
  payee: string;
  amount: number;
  checkNumber: string | null;
  overrideReason: string | null;
  voided: boolean;
  voidReason: string | null;
  lines: PaymentLine[];
};
type Reconciliation = { expected: number; actual: number; delta: number };
type Parked = { id: string; payerEmail: string | null; amountCents: number; receivedAt: string };
type ContactHit = { id: string; displayName: string };

/**
 * Feature 019 US2 (B28) + 023: the FS records ACTUAL performer disbursements (checks). One check may cover
 * several bookings, each with its own applied amount (per-line allocation); the check total is the sum of
 * its lines. Bookings may be from other events (cross-event delayed checks). A written check is voided (it
 * persists for the treasurer), never deleted, when it was wrong or the performer no-showed.
 */
export default function PaymentsPage() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [performers, setPerformers] = useState<Performer[]>([]);
  const [eventId, setEventId] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [recon, setRecon] = useState<Reconciliation | null>(null);
  const [error, setError] = useState<string | null>(null);

  // New-payment form
  const [payeeId, setPayeeId] = useState("");
  const [checkNumber, setCheckNumber] = useState("");
  const [reason, setReason] = useState("");
  // Selected bookings → the amount applied to each (per-line allocation).
  const [lineAmounts, setLineAmounts] = useState<Record<string, string>>({});

  // Parked online payments (US3 manual-link fallback)
  const [parked, setParked] = useState<Parked[]>([]);
  const [linkQuery, setLinkQuery] = useState<Record<string, string>>({});
  const [linkHits, setLinkHits] = useState<Record<string, ContactHit[]>>({});

  const loadParked = useCallback(async () => {
    const res = await apiFetch("/api/membership-captures/parked");
    if (!res.ok) return; // FS/Treasurer only; a base user simply sees no panel
    setParked((await res.json()).parked ?? []);
  }, []);

  useEffect(() => {
    void apiFetch("/api/events")
      .then((r) => r.json())
      .then((d) => setEvents(Array.isArray(d.items) ? d.items : []))
      .catch(() => setError("Could not load events"));
    void apiFetch("/api/performers")
      .then((r) => r.json())
      .then((d) => setPerformers(Array.isArray(d.items) ? d.items : []))
      .catch(() => setError("Could not load performers"));
    void loadParked();
  }, [loadParked]);

  async function searchContacts(notifId: string, q: string) {
    setLinkQuery((m) => ({ ...m, [notifId]: q }));
    if (q.length < 2) return setLinkHits((m) => ({ ...m, [notifId]: [] }));
    const res = await apiFetch(`/api/contacts?q=${encodeURIComponent(q)}`);
    const d = await res.json();
    setLinkHits((m) => ({ ...m, [notifId]: d.items ?? [] }));
  }

  async function linkParked(notifId: string, contactId: string) {
    const res = await apiFetch(`/api/membership-captures/${notifId}/link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId }),
    });
    if (!res.ok) return setError("Could not link this payment.");
    await loadParked();
  }

  const loadEvent = useCallback(async (id: string) => {
    setEventId(id);
    setLineAmounts({});
    if (!id) {
      setBookings([]);
      setPayments([]);
      setRecon(null);
      return;
    }
    const [bRes, pRes] = await Promise.all([
      apiFetch(`/api/events/${id}/bookings`),
      apiFetch(`/api/events/${id}/performer-payments`),
    ]);
    const bBody = await bRes.json();
    setBookings(Array.isArray(bBody.bookings) ? bBody.bookings : []);
    const pBody = await pRes.json();
    setPayments(Array.isArray(pBody.payments) ? pBody.payments : []);
    setRecon(pBody.reconciliation ?? null);
  }, []);

  async function refreshPayments(id: string) {
    const pRes = await apiFetch(`/api/events/${id}/performer-payments`);
    const pBody = await pRes.json();
    setPayments(pBody.payments ?? []);
    setRecon(pBody.reconciliation ?? null);
  }

  // A booking is "on the check" when it has an amount entry; toggling seeds it with the expected pay.
  function toggleBooking(b: Booking) {
    setLineAmounts((prev) => {
      if (b.id in prev) {
        const next = { ...prev };
        delete next[b.id];
        return next;
      }
      return { ...prev, [b.id]: (b.payCents / 100).toFixed(2) };
    });
  }

  const lines = Object.entries(lineAmounts).map(([bookingId, amt]) => ({
    bookingId,
    amount: Number(amt) || 0,
  }));
  const total = lines.reduce((a, l) => a + l.amount, 0);

  async function record() {
    setError(null);
    const res = await apiFetch("/api/performer-payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId,
        payeePerformerId: payeeId,
        lines,
        ...(checkNumber ? { checkNumber } : {}),
        ...(reason ? { overrideReason: reason } : {}),
      }),
    });
    if (res.status === 403)
      return setError("Only the Financial Secretary or Treasurer may record payments.");
    if (!res.ok) {
      const b = await res.json().catch(() => null);
      return setError(b?.error?.message ?? "Could not record payment");
    }
    setCheckNumber("");
    setReason("");
    setLineAmounts({});
    setPayeeId("");
    await refreshPayments(eventId);
  }

  async function voidPayment(id: string) {
    const res = await apiFetch(`/api/performer-payments/${id}/void`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "voided by FS" }),
    });
    if (!res.ok) return setError("Could not void payment");
    await refreshPayments(eventId);
  }

  return (
    <main>
      <h1>Performer payments</h1>
      {error && <p role="alert">{error}</p>}

      <label>
        Event{" "}
        <select value={eventId} onChange={(e) => void loadEvent(e.target.value)}>
          <option value="">— select an event —</option>
          {events.map((ev) => (
            <option key={ev.id} value={ev.id}>
              {ev.eventDate}
            </option>
          ))}
        </select>
      </label>

      {eventId && (
        <>
          <h2>Record a check</h2>
          <div>
            <label>
              Payee{" "}
              <select value={payeeId} onChange={(e) => setPayeeId(e.target.value)}>
                <option value="">— performer —</option>
                {performers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.displayName}
                  </option>
                ))}
              </select>
            </label>{" "}
            <label>
              Check # <input value={checkNumber} onChange={(e) => setCheckNumber(e.target.value)} />
            </label>{" "}
            <label>
              Note <input value={reason} onChange={(e) => setReason(e.target.value)} />
            </label>
          </div>
          <fieldset>
            <legend>Bookings settled by this check (amount applied to each)</legend>
            {bookings.length === 0 && <p>No bookings on this event.</p>}
            {bookings.map((b) => (
              <label key={b.id} style={{ display: "block" }}>
                <input
                  type="checkbox"
                  checked={b.id in lineAmounts}
                  onChange={() => toggleBooking(b)}
                />{" "}
                {b.performerName} ({b.performerType}) — booked ${(b.payCents / 100).toFixed(2)}{" "}
                {b.id in lineAmounts && (
                  <input
                    aria-label={`Amount for ${b.performerName}`}
                    value={lineAmounts[b.id]}
                    onChange={(e) => setLineAmounts((m) => ({ ...m, [b.id]: e.target.value }))}
                    inputMode="decimal"
                    style={{ width: 80 }}
                  />
                )}
              </label>
            ))}
          </fieldset>
          <p>
            Check total: <strong>${total.toFixed(2)}</strong>
          </p>
          <button onClick={() => void record()} disabled={!payeeId || lines.length === 0}>
            Record check
          </button>

          <h2>Recorded checks</h2>
          {recon && (
            <p>
              Expected ${recon.expected.toFixed(2)} · Actual ${recon.actual.toFixed(2)} ·{" "}
              <strong>Delta ${recon.delta.toFixed(2)}</strong>
            </p>
          )}
          <ul>
            {payments.map((p) => (
              <li key={p.id} style={{ opacity: p.voided ? 0.5 : 1 }}>
                {p.payee} — ${p.amount.toFixed(2)}
                {p.checkNumber ? ` · check ${p.checkNumber}` : ""}
                {p.overrideReason ? ` · ${p.overrideReason}` : ""} ({p.lines.length} booking
                {p.lines.length === 1 ? "" : "s"})
                {p.voided ? (
                  <em> — VOIDED{p.voidReason ? ` (${p.voidReason})` : ""}</em>
                ) : (
                  <>
                    {" "}
                    <button onClick={() => void voidPayment(p.id)}>Void</button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {parked.length > 0 && (
        <section>
          <h2>Parked online payments</h2>
          <p style={{ color: "#666" }}>
            Verified PayPal payments we could not auto-match to a member. Link each to a contact to
            create/renew their membership.
          </p>
          <ul>
            {parked.map((p) => (
              <li key={p.id} style={{ marginBottom: 8 }}>
                {p.payerEmail ?? "(no email)"} — ${(p.amountCents / 100).toFixed(2)}
                <br />
                <input
                  placeholder="Search a contact…"
                  value={linkQuery[p.id] ?? ""}
                  onChange={(e) => void searchContacts(p.id, e.target.value)}
                />
                {(linkHits[p.id] ?? []).map((c) => (
                  <button key={c.id} onClick={() => void linkParked(p.id, c.id)}>
                    Link {c.displayName}
                  </button>
                ))}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
