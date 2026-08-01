"use client";
import { apiFetch } from "@/app/apiFetch";

import { useCallback, useEffect, useState } from "react";

// Feature 020 US2 (FR-007..FR-013): the booking modal — create / edit / read-only shells over the existing
// booking API. One Save commits all fields (no save-on-close); Cancel discards; a non-Booker gets Close
// only. Performer selection is a typeahead; an unknown person is added by linking an existing contact.

type BookingLite = {
  id: string;
  performerId: string;
  performer: string;
  type: string;
  payCents: number;
  note: string | null;
  status: string;
};

type Props = {
  mode: "create" | "edit" | "readonly";
  eventId: string;
  eventDate: string;
  role?: string; // create: the slot's performer type
  booking?: BookingLite;
  onClose: () => void;
  onSaved?: () => void;
};

const STATUSES = ["proposed", "requested", "tentative", "confirmed", "declined"] as const;
const MONTHS =
  "January February March April May June July August September October November December".split(
    " ",
  );

function friendlyDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

export function BookingModal({ mode, eventId, eventDate, role, booking, onClose, onSaved }: Props) {
  const readOnly = mode === "readonly";
  const [performerId, setPerformerId] = useState(booking?.performerId ?? "");
  const [performerName, setPerformerName] = useState(booking?.performer ?? "");
  const [pay, setPay] = useState(booking ? String(booking.payCents / 100) : "");
  const [note, setNote] = useState(booking?.note ?? "");
  const [status, setStatus] = useState(booking?.status ?? "proposed");
  const [error, setError] = useState<string | null>(null);

  // Performer typeahead + add-performer hand-off
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<{ id: string; displayName: string }[]>([]);

  // Feature 024 US3: substitute a performer on an existing booking. The server branches on the written-check
  // discriminator (unpaid → clean re-point; live-paid → keep the no-show + add a fresh booking).
  const [subQ, setSubQ] = useState("");
  const [subHits, setSubHits] = useState<{ id: string; displayName: string }[]>([]);
  const [addingContactQ, setAddingContactQ] = useState<string | null>(null);
  const [contactHits, setContactHits] = useState<{ id: string; displayName: string }[]>([]);
  const [newEmail, setNewEmail] = useState(""); // optional email for a brand-new performer's contact
  // Feature 026: structured names for a brand-new performer (seeded by splitting the typed query).
  const [newFirst, setNewFirst] = useState("");
  const [newLast, setNewLast] = useState("");

  // mailto (edit/readonly): PII, fetched from a contact.pii.read endpoint
  const [mailto, setMailto] = useState<string | null>(null);
  useEffect(() => {
    if (!booking?.performerId) return;
    void apiFetch(`/api/performers/${booking.performerId}/mailto`)
      .then((r) => r.json())
      .then((d) => setMailto(d.email ?? null))
      .catch(() => setMailto(null));
  }, [booking?.performerId]);

  const search = useCallback(async (value: string) => {
    setQ(value);
    setAddingContactQ(null);
    if (value.trim().length < 1) return setHits([]);
    const res = await apiFetch(`/api/performers?q=${encodeURIComponent(value)}`);
    setHits((await res.json()).items ?? []);
  }, []);

  function pick(id: string, name: string) {
    setPerformerId(id);
    setPerformerName(name);
    setHits([]);
    setQ("");
  }

  async function searchContacts(value: string) {
    setAddingContactQ(value);
    if (value.trim().length < 2) return setContactHits([]);
    const res = await apiFetch(`/api/contacts?q=${encodeURIComponent(value)}`);
    setContactHits((await res.json()).items ?? []);
  }

  /** Split a typed name into first/last on the last space (a convenience seed; the fields stay editable). */
  function seedNames(name: string) {
    const trimmed = name.trim();
    const i = trimmed.lastIndexOf(" ");
    setNewFirst(i === -1 ? trimmed : trimmed.slice(0, i));
    setNewLast(i === -1 ? "" : trimmed.slice(i + 1));
  }

  // Add-performer hand-off (FR-013): link an EXISTING contact to a new performer, then select it. Feature 026:
  // no name is captured — the performer's display comes from the linked contact.
  async function addPerformer(contactId: string) {
    const res = await apiFetch("/api/performers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId }),
    });
    if (!res.ok) return setError("Could not add performer");
    const created = await res.json();
    pick(created.id, created.displayName);
    setAddingContactQ(null);
  }

  // Feature 020 + 026: the person isn't a contact yet → create a brand-new contact + performer inline, with
  // STRUCTURED first/last (+ optional email labeled 'booking'). Names are seeded from the typed query but the
  // FS can correct the split before creating.
  async function createNewPerformer() {
    const firstName = newFirst.trim();
    if (!firstName) return setError("A first name is required");
    const res = await apiFetch("/api/performers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName,
        ...(newLast.trim() ? { lastName: newLast.trim() } : {}),
        ...(newEmail.trim() ? { email: newEmail.trim(), emailPurpose: "booking" } : {}),
      }),
    });
    if (!res.ok) return setError("Could not create performer");
    const created = await res.json();
    pick(created.id, created.displayName);
    setAddingContactQ(null);
    setNewFirst("");
    setNewLast("");
    setNewEmail("");
  }

  async function searchSub(value: string) {
    setSubQ(value);
    if (value.trim().length < 1) return setSubHits([]);
    const res = await apiFetch(`/api/performers?q=${encodeURIComponent(value)}`);
    setSubHits((await res.json()).items ?? []);
  }

  // Feature 024 US3: POST the substitute. The server does the right thing per the discriminator; either way
  // the substitute ends up with their own booking (a clean re-point, or a fresh booking beside the no-show).
  async function substitute(newPerformerId: string) {
    if (!booking) return;
    setError(null);
    const res = await apiFetch(`/api/bookings/${booking.id}/substitute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPerformerId }),
    });
    if (res.status === 403) return setError("Only the Booker may substitute a performer.");
    if (!res.ok) return setError("Could not substitute performer");
    onSaved?.();
    onClose();
  }

  async function save() {
    setError(null);
    if (mode === "create") {
      if (!performerId) return setError("Choose a performer");
      const res = await apiFetch(`/api/events/${eventId}/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          performerId,
          performerType: role,
          ...(pay ? { pay: Number(pay) } : {}),
        }),
      });
      if (res.status === 403) return setError("Only the Booker may create bookings.");
      if (!res.ok) return setError("Could not create booking");
    } else if (booking) {
      const res = await apiFetch(`/api/bookings/${booking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          performerId, // may be a substitute → server re-points + resets to proposed
          pay: Number(pay) || 0,
          note,
          status,
        }),
      });
      if (res.status === 403) return setError("Only the Booker may edit bookings.");
      if (!res.ok) {
        // Feature 024 (FR-005): a re-point of a booking settled by a live check is refused (422) with a
        // message that names the cause and points at the substitute action; surface it inline.
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        return setError(body?.error?.message ?? "Could not save booking");
      }
    }
    onSaved?.();
    onClose();
  }

  return (
    <div
      role="dialog"
      aria-label="Booking"
      style={{ border: "1px solid #ccc", padding: 16, maxWidth: 460 }}
    >
      <h2>{mode === "create" ? `New ${role ?? "booking"}` : `Booking — ${performerName}`}</h2>
      {error && <p role="alert">{error}</p>}

      {mode === "create" && (
        <div>
          <label>
            Search performer{" "}
            <input
              aria-label="Search performer"
              value={q}
              onChange={(e) => void search(e.target.value)}
            />
          </label>
          <ul>
            {hits.map((h) => (
              <li key={h.id}>
                <button type="button" onClick={() => pick(h.id, h.displayName)}>
                  {h.displayName}
                </button>
              </li>
            ))}
          </ul>
          {q.trim() && hits.length === 0 && (
            <div>
              <button
                type="button"
                onClick={() => {
                  seedNames(q);
                  void searchContacts(q);
                }}
              >
                Add performer “{q}”
              </button>
              {addingContactQ !== null && (
                <>
                  <input
                    aria-label="Search contact"
                    value={addingContactQ}
                    onChange={(e) => void searchContacts(e.target.value)}
                  />
                  <ul>
                    {contactHits.map((c) => (
                      <li key={c.id}>
                        <button type="button" onClick={() => void addPerformer(c.id)}>
                          Link {c.displayName}
                        </button>
                      </li>
                    ))}
                  </ul>
                  {addingContactQ.trim().length >= 2 && contactHits.length === 0 && (
                    <div style={{ marginTop: 6 }}>
                      <p style={{ margin: "4px 0", color: "#555" }}>
                        No contact found — create a new performer and contact:
                      </p>
                      <input
                        aria-label="New performer first name"
                        placeholder="First name"
                        value={newFirst}
                        onChange={(e) => setNewFirst(e.target.value)}
                      />{" "}
                      <input
                        aria-label="New performer last name"
                        placeholder="Last name (optional)"
                        value={newLast}
                        onChange={(e) => setNewLast(e.target.value)}
                      />{" "}
                      <input
                        aria-label="New performer email"
                        type="email"
                        placeholder="Email (optional)"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                      />{" "}
                      <button
                        type="button"
                        disabled={!newFirst.trim()}
                        onClick={() => void createNewPerformer()}
                      >
                        Create performer
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          {performerName && <p>Selected: {performerName}</p>}
        </div>
      )}

      <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
        <label>
          Pay{" "}
          <input
            value={pay}
            onChange={(e) => setPay(e.target.value)}
            disabled={readOnly}
            inputMode="decimal"
          />
        </label>
        <label>
          Notes{" "}
          <input
            aria-label="Notes"
            value={note ?? ""}
            onChange={(e) => setNote(e.target.value)}
            disabled={readOnly}
          />
        </label>
        {mode !== "create" && (
          <label>
            Status{" "}
            <select value={status} onChange={(e) => setStatus(e.target.value)} disabled={readOnly}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        )}
        {mailto && (
          <a
            href={`mailto:${mailto}?subject=${encodeURIComponent(`Rochester Dance ${friendlyDate(eventDate)}`)}`}
          >
            Email {performerName}
          </a>
        )}
      </div>

      {mode === "edit" && booking && (
        <div style={{ marginTop: 12, borderTop: "1px solid #eee", paddingTop: 8 }}>
          <label>
            Substitute performer{" "}
            <input
              aria-label="Substitute performer"
              value={subQ}
              onChange={(e) => void searchSub(e.target.value)}
            />
          </label>
          <p style={{ margin: "4px 0", color: "#555" }}>
            <small>
              A paid booking is kept as a no-show and the substitute is added as a new booking.
            </small>
          </p>
          <ul>
            {subHits.map((h) => (
              <li key={h.id}>
                <button type="button" onClick={() => void substitute(h.id)}>
                  Substitute in {h.displayName}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        {readOnly ? (
          <button type="button" onClick={onClose}>
            Close
          </button>
        ) : (
          <>
            <button type="button" onClick={() => void save()}>
              Save
            </button>
            <button type="button" onClick={onClose}>
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}
