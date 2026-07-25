"use client";

import { useCallback, useEffect, useState } from "react";

type EventRow = { id: string; eventDate: string };
type Performer = { id: string; displayName: string };
type Booking = { id: string; performerName: string; performerType: string; payCents: number };
type Payment = {
  id: string;
  payee: string;
  amount: number;
  checkNumber: string | null;
  overrideReason: string | null;
  bookingIds: string[];
};
type Reconciliation = { expected: number; actual: number; delta: number };
type Parked = { id: string; payerEmail: string | null; amountCents: number; receivedAt: string };
type ContactHit = { id: string; displayName: string };

/**
 * Feature 019 US2 (B28): the FS records ACTUAL performer disbursements — payee may differ from the booked
 * performer (substitution), one check may cover several bookings (aggregation). The booked rate is left as
 * the expected figure. An unknown substitute is added first on the Performers page (the FS holds
 * performer.write, FR-009a); the picker here is over existing performers.
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
  const [amount, setAmount] = useState("");
  const [checkNumber, setCheckNumber] = useState("");
  const [reason, setReason] = useState("");
  const [bookingIds, setBookingIds] = useState<string[]>([]);

  // Parked online payments (US3 manual-link fallback)
  const [parked, setParked] = useState<Parked[]>([]);
  const [linkQuery, setLinkQuery] = useState<Record<string, string>>({});
  const [linkHits, setLinkHits] = useState<Record<string, ContactHit[]>>({});

  const loadParked = useCallback(async () => {
    const res = await fetch("/api/membership-captures/parked");
    if (!res.ok) return; // FS/Treasurer only; a base user simply sees no panel
    setParked((await res.json()).parked ?? []);
  }, []);

  useEffect(() => {
    // Both endpoints return { items: [...] } (feature 016 convention).
    void fetch("/api/events")
      .then((r) => r.json())
      .then((d) => setEvents(Array.isArray(d.items) ? d.items : []))
      .catch(() => setError("Could not load events"));
    void fetch("/api/performers")
      .then((r) => r.json())
      .then((d) => setPerformers(Array.isArray(d.items) ? d.items : []))
      .catch(() => setError("Could not load performers"));
    void loadParked();
  }, [loadParked]);

  async function searchContacts(notifId: string, q: string) {
    setLinkQuery((m) => ({ ...m, [notifId]: q }));
    if (q.length < 2) return setLinkHits((m) => ({ ...m, [notifId]: [] }));
    const res = await fetch(`/api/contacts?q=${encodeURIComponent(q)}`);
    const d = await res.json();
    setLinkHits((m) => ({ ...m, [notifId]: d.items ?? [] }));
  }

  async function linkParked(notifId: string, contactId: string) {
    const res = await fetch(`/api/membership-captures/${notifId}/link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId }),
    });
    if (!res.ok) return setError("Could not link this payment.");
    await loadParked();
  }

  const loadEvent = useCallback(async (id: string) => {
    setEventId(id);
    setBookingIds([]);
    if (!id) {
      setBookings([]);
      setPayments([]);
      setRecon(null);
      return;
    }
    const [bRes, pRes] = await Promise.all([
      fetch(`/api/events/${id}/bookings`),
      fetch(`/api/events/${id}/performer-payments`),
    ]);
    const bBody = await bRes.json();
    setBookings(Array.isArray(bBody.bookings) ? bBody.bookings : []);
    const pBody = await pRes.json();
    setPayments(Array.isArray(pBody.payments) ? pBody.payments : []);
    setRecon(pBody.reconciliation ?? null);
  }, []);

  async function refreshPayments(id: string) {
    const pRes = await fetch(`/api/events/${id}/performer-payments`);
    const pBody = await pRes.json();
    setPayments(pBody.payments ?? []);
    setRecon(pBody.reconciliation ?? null);
  }

  async function record() {
    setError(null);
    const res = await fetch("/api/performer-payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId,
        payeePerformerId: payeeId,
        amount: Number(amount) || 0,
        bookingIds,
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
    setAmount("");
    setCheckNumber("");
    setReason("");
    setBookingIds([]);
    setPayeeId("");
    await refreshPayments(eventId);
  }

  async function remove(id: string) {
    const res = await fetch(`/api/performer-payments/${id}`, { method: "DELETE" });
    if (!res.ok && res.status !== 204) return setError("Could not delete payment");
    await refreshPayments(eventId);
  }

  function toggleBooking(id: string) {
    setBookingIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
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
          <h2>Record a payment</h2>
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
              Amount{" "}
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
              />
            </label>{" "}
            <label>
              Check # <input value={checkNumber} onChange={(e) => setCheckNumber(e.target.value)} />
            </label>{" "}
            <label>
              Reason <input value={reason} onChange={(e) => setReason(e.target.value)} />
            </label>
          </div>
          <fieldset>
            <legend>Bookings settled by this payment</legend>
            {bookings.length === 0 && <p>No bookings on this event.</p>}
            {bookings.map((b) => (
              <label key={b.id} style={{ display: "block" }}>
                <input
                  type="checkbox"
                  checked={bookingIds.includes(b.id)}
                  onChange={() => toggleBooking(b.id)}
                />{" "}
                {b.performerName} ({b.performerType}) — booked ${(b.payCents / 100).toFixed(2)}
              </label>
            ))}
          </fieldset>
          <button onClick={() => void record()} disabled={!payeeId || bookingIds.length === 0}>
            Record payment
          </button>

          <h2>Recorded payments</h2>
          {recon && (
            <p>
              Expected ${recon.expected.toFixed(2)} · Actual ${recon.actual.toFixed(2)} ·{" "}
              <strong>Delta ${recon.delta.toFixed(2)}</strong>
            </p>
          )}
          <ul>
            {payments.map((p) => (
              <li key={p.id}>
                {p.payee} — ${p.amount.toFixed(2)}
                {p.checkNumber ? ` · check ${p.checkNumber}` : ""}
                {p.overrideReason ? ` · ${p.overrideReason}` : ""} ({p.bookingIds.length} booking
                {p.bookingIds.length === 1 ? "" : "s"}){" "}
                <button onClick={() => void remove(p.id)}>Delete</button>
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
