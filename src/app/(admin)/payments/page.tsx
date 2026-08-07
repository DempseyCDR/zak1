"use client";
import { apiFetch } from "@/app/apiFetch";
import { EventSelector } from "@/app/EventSelector";

import { useCallback, useEffect, useState } from "react";

// Feature 030 (P5-R3): the payments page is organized as ONE ROW PER PERFORMER. The FS writes a separate
// check per performer (enter a check number → booked amount is assumed). Non-paying bookings show as free;
// a paid booking can be donated at settlement (0 + no check#); the occasional one-check-many-bookings path
// lives in a popup; a recorded payment is edited inline; a last-minute performer can be added. Built over the
// unchanged 023 substrate (createPerformerPayment / patch / void) + the 028 event selector.
type Performer = { id: string; displayName: string };
type Booking = {
  id: string;
  performerId: string;
  performerName: string;
  performerType: string;
  payCents: number;
  requiresCheck: boolean;
  isDonated: boolean;
};
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

const money = (dollars: number) => `$${dollars.toFixed(2)}`;

type RowState =
  | { kind: "free" }
  | { kind: "paid-here"; payment: Payment; lineAmount: number }
  | { kind: "settled-elsewhere" }
  | { kind: "outstanding" };

export default function PaymentsPage() {
  const [performers, setPerformers] = useState<Performer[]>([]);
  const [eventId, setEventId] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [settledByBooking, setSettledByBooking] = useState<Record<string, number>>({});
  const [recon, setRecon] = useState<Reconciliation | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Per-row entry (FR-002/003/014/015): each payable row's own check# + amount.
  const [rowCheck, setRowCheck] = useState<Record<string, string>>({});
  const [rowAmount, setRowAmount] = useState<Record<string, string>>({});

  // Confirmations (FR-007 donate; FR-014 check-less).
  const [donateFor, setDonateFor] = useState<Booking | null>(null);
  const [checkless, setCheckless] = useState<{
    booking: Booking;
    amount: number;
    comment: string;
  } | null>(null);

  // Inline edit of a paid row (US5).
  const [editId, setEditId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editCheck, setEditCheck] = useState("");

  // Feature 043 (D3): check-number-only edit for a MULTI-line payment (preserves the allocation).
  const [checkEditId, setCheckEditId] = useState<string | null>(null);
  const [checkEditVal, setCheckEditVal] = useState("");

  // Multi-apply popup (US4): the old payee-dropdown + booking-checkbox flow, relocated.
  const [multiOpen, setMultiOpen] = useState(false);
  const [payeeId, setPayeeId] = useState("");
  const [multiCheck, setMultiCheck] = useState("");
  const [multiNote, setMultiNote] = useState("");
  const [multiLines, setMultiLines] = useState<Record<string, string>>({});

  // Add-performer (US6).
  const [addOpen, setAddOpen] = useState(false);
  const [addQ, setAddQ] = useState("");
  const [addType, setAddType] = useState("musician");

  // Substitute a performer (feature 043 P6-R12): moved here from /gate.
  const [subOpen, setSubOpen] = useState(false);
  const [subBookingId, setSubBookingId] = useState("");
  const [subQ, setSubQ] = useState("");

  // Parked online payments (019 US3 manual-link fallback) — unchanged.
  const [parked, setParked] = useState<Parked[]>([]);
  const [linkQuery, setLinkQuery] = useState<Record<string, string>>({});
  const [linkHits, setLinkHits] = useState<Record<string, ContactHit[]>>({});

  const loadParked = useCallback(async () => {
    const res = await apiFetch("/api/membership-captures/parked");
    if (!res.ok) return;
    setParked((await res.json()).parked ?? []);
  }, []);

  useEffect(() => {
    void apiFetch("/api/performers")
      .then((r) => r.json())
      .then((d) => setPerformers(Array.isArray(d.items) ? d.items : []))
      .catch(() => setError("Could not load performers"));
    void loadParked();
  }, [loadParked]);

  const refresh = useCallback(async (id: string) => {
    if (!id) {
      setBookings([]);
      setPayments([]);
      setSettledByBooking({});
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
    setSettledByBooking(pBody.settledByBooking ?? {});
    setRecon(pBody.reconciliation ?? null);
  }, []);

  const loadEvent = useCallback(
    async (id: string) => {
      setEventId(id);
      setRowCheck({});
      setRowAmount({});
      setError(null);
      await refresh(id);
    },
    [refresh],
  );

  // Row classification (FR-006/016): free / paid-here / settled-elsewhere / outstanding.
  function classify(b: Booking): RowState {
    if (!b.requiresCheck) return { kind: "free" };
    const payment = payments.find((p) => !p.voided && p.lines.some((l) => l.bookingId === b.id));
    if (payment) {
      const line = payment.lines.find((l) => l.bookingId === b.id);
      return { kind: "paid-here", payment, lineAmount: line?.amount ?? payment.amount };
    }
    if ((settledByBooking[b.id] ?? 0) > 0) return { kind: "settled-elsewhere" };
    return { kind: "outstanding" };
  }

  async function post(url: string, body: unknown, method = "POST"): Promise<boolean> {
    setError(null);
    const res = await apiFetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status === 403) {
      setError("Only the Financial Secretary or Treasurer may record payments.");
      return false;
    }
    if (!res.ok) {
      const b = await res.json().catch(() => null);
      setError(b?.error?.message ?? "Could not save");
      return false;
    }
    return true;
  }

  async function recordCheck(
    b: Booking,
    amount: number,
    checkNumber: string | null,
    overrideReason?: string,
  ) {
    const ok = await post("/api/performer-payments", {
      eventId,
      payeePerformerId: b.performerId,
      lines: [{ bookingId: b.id, amount }],
      ...(checkNumber ? { checkNumber } : {}),
      ...(overrideReason ? { overrideReason } : {}),
    });
    if (ok) {
      setRowCheck((m) => ({ ...m, [b.id]: "" }));
      setRowAmount((m) => ({ ...m, [b.id]: "" }));
      await refresh(eventId);
    }
  }

  // Per-row commit (FR-015): decide the path from what Mary typed on this one row.
  async function commitRow(b: Booking) {
    const check = (rowCheck[b.id] ?? "").trim();
    const amtStr = (rowAmount[b.id] ?? "").trim();
    const hasAmt = amtStr !== "";
    const amt = Number(amtStr);
    if (hasAmt && amt === 0 && !check) return setDonateFor(b); // FR-007 → confirm
    if (hasAmt && amt > 0 && !check) return setCheckless({ booking: b, amount: amt, comment: "" }); // FR-014
    if (!check) return; // untouched / nothing to record → stays outstanding (FR-004)
    await recordCheck(b, hasAmt ? amt : b.payCents / 100, check); // blank amount → booked (FR-002)
  }

  async function confirmDonate() {
    const b = donateFor;
    if (!b) return;
    const ok = await post(`/api/bookings/${b.id}/donate`, {});
    setDonateFor(null);
    if (ok) await refresh(eventId);
  }

  async function confirmCheckless() {
    const c = checkless;
    if (!c) return;
    setCheckless(null);
    await recordCheck(c.booking, c.amount, null, c.comment);
  }

  async function saveEdit(payment: Payment, bookingId: string) {
    const ok = await post(
      `/api/performer-payments/${payment.id}`,
      {
        lines: [{ bookingId, amount: Number(editAmount) || 0 }],
        ...(editCheck ? { checkNumber: editCheck } : { checkNumber: null }),
      },
      "PATCH",
    );
    if (ok) {
      setEditId(null);
      await refresh(eventId);
    }
  }

  // Feature 043 (D3): correct a multi-line payment's check number in place — PATCH { checkNumber } with NO
  // `lines`, so the per-line allocation is preserved (the service only replaces lines when they are sent).
  async function saveCheckOnly(payment: Payment) {
    const ok = await post(
      `/api/performer-payments/${payment.id}`,
      { checkNumber: checkEditVal.trim() || null },
      "PATCH",
    );
    if (ok) {
      setCheckEditId(null);
      await refresh(eventId);
    }
  }

  async function voidPayment(id: string) {
    const res = await apiFetch(`/api/performer-payments/${id}/void`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "voided by FS" }),
    });
    if (!res.ok) return setError("Could not void payment");
    await refresh(eventId);
  }

  async function recordMulti() {
    const lines = Object.entries(multiLines).flatMap(([bookingId, amt]) => {
      const v = Number(amt);
      return v > 0 ? [{ bookingId, amount: v }] : [];
    });
    if (!payeeId || lines.length === 0) return;
    // Feature 043 (D3): the FR-014 checkless guard the per-row path applies (commitRow) — a positive check with
    // no number needs a comment on record. Never force a check number; the note (overrideReason) satisfies it.
    const total = lines.reduce((s, l) => s + l.amount, 0);
    if (total > 0 && !multiCheck.trim() && !multiNote.trim()) {
      setError("Enter a check number, or a note explaining why there is no check.");
      return;
    }
    const ok = await post("/api/performer-payments", {
      eventId,
      payeePerformerId: payeeId,
      lines,
      ...(multiCheck ? { checkNumber: multiCheck } : {}),
      ...(multiNote ? { overrideReason: multiNote } : {}),
    });
    if (ok) {
      setMultiOpen(false);
      setPayeeId("");
      setMultiCheck("");
      setMultiNote("");
      setMultiLines({});
      await refresh(eventId);
    }
  }

  async function addPerformer(performerId: string) {
    const ok = await post(`/api/events/${eventId}/settlement-performer`, {
      performerId,
      performerType: addType,
    });
    if (ok) {
      setAddOpen(false);
      setAddQ("");
      await refresh(eventId);
    }
  }

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

  const addHits = addQ.trim()
    ? performers.filter((p) => p.displayName.toLowerCase().includes(addQ.trim().toLowerCase()))
    : [];

  // Feature 043 (P6-R12): substitute a performer on a booking (unpaid → clean re-point; live-paid → keep the
  // no-show + book the sub). Authorized by the FS's performer_payment.write (or the Booker's booking.write).
  const subHits = subQ.trim()
    ? performers.filter((p) => p.displayName.toLowerCase().includes(subQ.trim().toLowerCase()))
    : [];

  async function substitute(newPerformerId: string) {
    if (!subBookingId) return;
    const ok = await post(`/api/bookings/${subBookingId}/substitute`, { newPerformerId });
    if (ok) {
      setSubOpen(false);
      setSubBookingId("");
      setSubQ("");
      await refresh(eventId);
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 760 }}>
      <h1>Performer payments</h1>
      {error && <p role="alert">{error}</p>}

      <EventSelector value={eventId} onSelect={(e) => void loadEvent(e.id)} />

      {eventId && (
        <>
          {recon && (
            <p>
              Expected {money(recon.expected)} · Actual {money(recon.actual)} ·{" "}
              <strong>Delta {money(recon.delta)}</strong>
            </p>
          )}

          <h2>Performers</h2>
          {bookings.length === 0 && <p>No bookings on this event.</p>}
          <ul style={{ listStyle: "none", padding: 0 }}>
            {bookings.map((b) => {
              const st = classify(b);
              return (
                <li key={b.id} style={{ borderTop: "1px solid #eee", padding: "8px 0" }}>
                  <strong>{b.performerName}</strong> <small>({b.performerType})</small>{" "}
                  {st.kind === "free" && (
                    <span style={{ color: "#888" }}>
                      — {b.isDonated ? "donated" : "free"} (no check)
                    </span>
                  )}
                  {st.kind === "settled-elsewhere" && (
                    <span style={{ color: "#2e7d32" }}>— paid (recorded at another event)</span>
                  )}
                  {st.kind === "outstanding" && (
                    <>
                      — booked {money(b.payCents / 100)}{" "}
                      <label>
                        <small>Check #</small>{" "}
                        <input
                          aria-label={`Check number for ${b.performerName}`}
                          value={rowCheck[b.id] ?? ""}
                          onChange={(e) => setRowCheck((m) => ({ ...m, [b.id]: e.target.value }))}
                          style={{ width: 80 }}
                        />
                      </label>{" "}
                      <label>
                        <small>Amount</small>{" "}
                        <input
                          aria-label={`Amount for ${b.performerName}`}
                          value={rowAmount[b.id] ?? ""}
                          onChange={(e) => setRowAmount((m) => ({ ...m, [b.id]: e.target.value }))}
                          inputMode="decimal"
                          placeholder="booked"
                          style={{ width: 70 }}
                        />
                      </label>{" "}
                      <button onClick={() => void commitRow(b)}>Record</button>
                    </>
                  )}
                  {st.kind === "paid-here" &&
                    (editId === st.payment.id ? (
                      <>
                        {" "}
                        <input
                          aria-label={`Edit amount for ${b.performerName}`}
                          value={editAmount}
                          onChange={(e) => setEditAmount(e.target.value)}
                          inputMode="decimal"
                          style={{ width: 70 }}
                        />{" "}
                        <input
                          aria-label={`Edit check number for ${b.performerName}`}
                          value={editCheck}
                          onChange={(e) => setEditCheck(e.target.value)}
                          style={{ width: 80 }}
                        />{" "}
                        <button onClick={() => void saveEdit(st.payment, b.id)}>Save</button>{" "}
                        <button onClick={() => setEditId(null)}>Cancel</button>
                      </>
                    ) : (
                      <>
                        — paid {money(st.lineAmount)}
                        {st.payment.checkNumber ? ` · check ${st.payment.checkNumber}` : ""}{" "}
                        {st.payment.lines.length === 1 && (
                          <button
                            onClick={() => {
                              setEditId(st.payment.id);
                              setEditAmount(st.lineAmount.toFixed(2));
                              setEditCheck(st.payment.checkNumber ?? "");
                            }}
                          >
                            Edit
                          </button>
                        )}{" "}
                        {/* Feature 043 (D3): a multi-line payment's check number is editable in place (once,
                            on the payment's first line) without touching the allocation. */}
                        {st.payment.lines.length > 1 &&
                          st.payment.lines[0]?.bookingId === b.id &&
                          (checkEditId === st.payment.id ? (
                            <>
                              <input
                                aria-label="New check number"
                                value={checkEditVal}
                                onChange={(e) => setCheckEditVal(e.target.value)}
                                style={{ width: 80 }}
                              />{" "}
                              <button onClick={() => void saveCheckOnly(st.payment)}>
                                Save check #
                              </button>{" "}
                              <button onClick={() => setCheckEditId(null)}>Cancel</button>{" "}
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => {
                                  setCheckEditId(st.payment.id);
                                  setCheckEditVal(st.payment.checkNumber ?? "");
                                }}
                              >
                                Edit check #
                              </button>{" "}
                            </>
                          ))}
                        <button onClick={() => void voidPayment(st.payment.id)}>Void</button>
                      </>
                    ))}
                </li>
              );
            })}
          </ul>

          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button onClick={() => setMultiOpen(true)}>
              Apply one check to multiple performers
            </button>
            <button onClick={() => setAddOpen(true)}>Add a performer</button>
            <button onClick={() => setSubOpen(true)}>Substitute a performer</button>
          </div>

          {donateFor && (
            <div role="dialog" aria-label="Confirm donation" style={dialogStyle}>
              <p>
                Mark <strong>{donateFor.performerName}</strong> as donating their fee tonight? Their
                booking becomes free (no check, no payment due).
              </p>
              <button onClick={() => void confirmDonate()}>Confirm donation</button>{" "}
              <button onClick={() => setDonateFor(null)}>Cancel</button>
            </div>
          )}

          {checkless && (
            <div
              role="dialog"
              aria-label="Confirm payment without a check number"
              style={dialogStyle}
            >
              <p>
                Record {money(checkless.amount)} to{" "}
                <strong>{checkless.booking.performerName}</strong> with <em>no check number</em>?
                Explain why:
              </p>
              <textarea
                aria-label="Reason for no check number"
                value={checkless.comment}
                onChange={(e) => setCheckless((c) => (c ? { ...c, comment: e.target.value } : c))}
                rows={2}
                style={{ width: "100%" }}
              />
              <button disabled={!checkless.comment.trim()} onClick={() => void confirmCheckless()}>
                Record without a check
              </button>{" "}
              <button onClick={() => setCheckless(null)}>Cancel</button>
            </div>
          )}

          {multiOpen && (
            <div
              role="dialog"
              aria-label="Apply one check to multiple bookings"
              style={dialogStyle}
            >
              <h3>One check, multiple performers</h3>
              <label>
                Payee{" "}
                <select
                  aria-label="Payee"
                  value={payeeId}
                  onChange={(e) => setPayeeId(e.target.value)}
                >
                  <option value="">— performer —</option>
                  {performers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.displayName}
                    </option>
                  ))}
                </select>
              </label>{" "}
              <label>
                Check # <input value={multiCheck} onChange={(e) => setMultiCheck(e.target.value)} />
              </label>{" "}
              <label>
                Note <input value={multiNote} onChange={(e) => setMultiNote(e.target.value)} />
              </label>
              <fieldset>
                <legend>Bookings settled by this check</legend>
                {bookings.map((b) => (
                  <label key={b.id} style={{ display: "block" }}>
                    <input
                      type="checkbox"
                      checked={b.id in multiLines}
                      onChange={() =>
                        setMultiLines((m) => {
                          if (b.id in m) {
                            const next = { ...m };
                            delete next[b.id];
                            return next;
                          }
                          return { ...m, [b.id]: (b.payCents / 100).toFixed(2) };
                        })
                      }
                    />{" "}
                    {b.performerName} ({b.performerType}) — booked {money(b.payCents / 100)}{" "}
                    {b.id in multiLines && (
                      <input
                        aria-label={`Amount for ${b.performerName}`}
                        value={multiLines[b.id]}
                        onChange={(e) => setMultiLines((m) => ({ ...m, [b.id]: e.target.value }))}
                        inputMode="decimal"
                        style={{ width: 80 }}
                      />
                    )}
                  </label>
                ))}
              </fieldset>
              <button onClick={() => void recordMulti()}>Record check</button>{" "}
              <button onClick={() => setMultiOpen(false)}>Cancel</button>
            </div>
          )}

          {addOpen && (
            <div role="dialog" aria-label="Add a performer" style={dialogStyle}>
              <h3>Add a last-minute performer</h3>
              <label>
                Role{" "}
                <select
                  aria-label="Role"
                  value={addType}
                  onChange={(e) => setAddType(e.target.value)}
                >
                  <option value="musician">musician</option>
                  <option value="lead_musician">lead musician</option>
                  <option value="caller">caller</option>
                  <option value="sound_tech">sound tech</option>
                </select>
              </label>{" "}
              <input
                aria-label="Find performer"
                placeholder="Find performer…"
                value={addQ}
                onChange={(e) => setAddQ(e.target.value)}
              />
              <ul style={{ listStyle: "none", padding: 0 }}>
                {addHits.map((p) => (
                  <li key={p.id}>
                    <button onClick={() => void addPerformer(p.id)}>Add {p.displayName}</button>
                  </li>
                ))}
              </ul>
              <button onClick={() => setAddOpen(false)}>Close</button>
            </div>
          )}

          {subOpen && (
            <div role="dialog" aria-label="Substitute a performer" style={dialogStyle}>
              <h3>Substitute a performer</h3>
              <p style={{ color: "#666" }}>
                <small>
                  Unpaid → re-pointed to the substitute. A booking already paid by a live check is
                  kept as a no-show and the substitute is booked fresh (void/reissue the check
                  separately).
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
                  {bookings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.performerName} ({b.performerType})
                    </option>
                  ))}
                </select>
              </label>{" "}
              <input
                aria-label="Find substitute"
                placeholder="Find substitute…"
                value={subQ}
                onChange={(e) => setSubQ(e.target.value)}
              />
              <ul style={{ listStyle: "none", padding: 0 }}>
                {subHits.map((p) => (
                  <li key={p.id}>
                    <button disabled={!subBookingId} onClick={() => void substitute(p.id)}>
                      Substitute in {p.displayName}
                    </button>
                  </li>
                ))}
              </ul>
              <button onClick={() => setSubOpen(false)}>Close</button>
            </div>
          )}
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
                {p.payerEmail ?? "(no email)"} — {money(p.amountCents / 100)}
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

const dialogStyle: React.CSSProperties = {
  border: "1px solid #ccc",
  padding: 16,
  marginTop: 12,
  maxWidth: 460,
};
