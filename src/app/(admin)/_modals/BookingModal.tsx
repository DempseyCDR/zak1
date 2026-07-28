"use client";

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
  const [addingContactQ, setAddingContactQ] = useState<string | null>(null);
  const [contactHits, setContactHits] = useState<{ id: string; displayName: string }[]>([]);
  const [newEmail, setNewEmail] = useState(""); // optional email for a brand-new performer's contact

  // mailto (edit/readonly): PII, fetched from a contact.pii.read endpoint
  const [mailto, setMailto] = useState<string | null>(null);
  useEffect(() => {
    if (!booking?.performerId) return;
    void fetch(`/api/performers/${booking.performerId}/mailto`)
      .then((r) => r.json())
      .then((d) => setMailto(d.email ?? null))
      .catch(() => setMailto(null));
  }, [booking?.performerId]);

  const search = useCallback(async (value: string) => {
    setQ(value);
    setAddingContactQ(null);
    if (value.trim().length < 1) return setHits([]);
    const res = await fetch(`/api/performers?q=${encodeURIComponent(value)}`);
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
    const res = await fetch(`/api/contacts?q=${encodeURIComponent(value)}`);
    setContactHits((await res.json()).items ?? []);
  }

  // Add-performer hand-off (FR-013): create a performer bound to an EXISTING contact, then select it.
  async function addPerformer(contactId: string, displayName: string) {
    const res = await fetch("/api/performers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName, contactId, ...(role ? { performerType: role } : {}) }),
    });
    if (!res.ok) return setError("Could not add performer");
    const created = await res.json();
    pick(created.id, created.displayName ?? displayName);
    setAddingContactQ(null);
  }

  // Feature 020: the person isn't a contact yet → create a brand-new contact + performer inline. An
  // optional email is labeled 'booking' (the purpose the performer mailto prefers). Named from the
  // original performer query `q`. createPerformer creates the contact when no contactId is given.
  async function createNewPerformer() {
    const displayName = q.trim();
    if (!displayName) return;
    const res = await fetch("/api/performers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName,
        ...(role ? { performerType: role } : {}),
        ...(newEmail.trim() ? { email: newEmail.trim(), emailPurpose: "booking" } : {}),
      }),
    });
    if (!res.ok) return setError("Could not create performer");
    const created = await res.json();
    pick(created.id, created.displayName ?? displayName);
    setAddingContactQ(null);
    setNewEmail("");
  }

  async function save() {
    setError(null);
    if (mode === "create") {
      if (!performerId) return setError("Choose a performer");
      const res = await fetch(`/api/events/${eventId}/bookings`, {
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
      const res = await fetch(`/api/bookings/${booking.id}`, {
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
      if (!res.ok) return setError("Could not save booking");
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
              <button type="button" onClick={() => void searchContacts(q)}>
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
                        <button
                          type="button"
                          onClick={() => void addPerformer(c.id, c.displayName)}
                        >
                          Link {c.displayName}
                        </button>
                      </li>
                    ))}
                  </ul>
                  {addingContactQ.trim().length >= 2 && contactHits.length === 0 && (
                    <div style={{ marginTop: 6 }}>
                      <p style={{ margin: "4px 0", color: "#555" }}>
                        No contact found — create “{q}” as a new performer and contact:
                      </p>
                      <input
                        aria-label="New performer email"
                        type="email"
                        placeholder="Email (optional)"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                      />{" "}
                      <button type="button" onClick={() => void createNewPerformer()}>
                        Create performer “{q}”
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
