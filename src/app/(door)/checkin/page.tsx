"use client";

import { useCallback, useEffect, useState } from "react";

type EventRow = { id: string; eventDate: string; seriesId: string; label: string | null };
type SeriesRow = { id: string; key: string; name: string };
type Candidate = { id: string; displayName: string; membershipStatus: string; emails: string[] };
type Attendee = {
  id: string;
  contactId: string | null;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  childrenCount: number;
  isOpenBand: boolean;
};
type RosterSort = "first" | "last";

export default function CheckinPage() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [series, setSeries] = useState<SeriesRow[]>([]);
  const [eventId, setEventId] = useState<string>("");
  const [q, setQ] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  // New-contact form (B34): first + last + editable display name.
  const [newFirst, setNewFirst] = useState("");
  const [newLast, setNewLast] = useState("");
  const [newDisplay, setNewDisplay] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");

  // Per-check-in extras (B35 children, B36 open-band).
  const [childrenCount, setChildrenCount] = useState("");
  const [isOpenBand, setIsOpenBand] = useState(false);

  // Comp + gift-card redemption counts captured at check-in (B29).
  const [compCount, setCompCount] = useState("");
  const [giftCount, setGiftCount] = useState("");

  // Checked-in roster (B33).
  const [roster, setRoster] = useState<Attendee[]>([]);
  const [rosterSort, setRosterSort] = useState<RosterSort>("last");

  const selectedEvent = events.find((e) => e.id === eventId);
  const communityDanceSeriesId = series.find((s) => s.key === "community_dance")?.id ?? null;
  const isCommunityDance = !!selectedEvent && selectedEvent.seriesId === communityDanceSeriesId;

  useEffect(() => {
    void fetch("/api/events")
      .then((r) => r.json())
      .then((d) => setEvents(d.items ?? []));
    void fetch("/api/series")
      .then((r) => r.json())
      .then((d) => setSeries(d.items ?? []));
  }, []);

  const loadRoster = useCallback(async (id: string, sort: RosterSort) => {
    if (!id) return setRoster([]);
    const res = await fetch(`/api/events/${id}/attendance?sort=${sort}`);
    const data = await res.json();
    setRoster(data.attendees ?? []);
  }, []);

  // Refresh the roster whenever the event or sort changes.
  useEffect(() => {
    void loadRoster(eventId, rosterSort);
  }, [eventId, rosterSort, loadRoster]);

  const search = useCallback(async (query: string) => {
    if (!query.trim()) return setCandidates([]);
    const res = await fetch(`/api/attendance/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    setCandidates(data.items ?? []);
  }, []);

  useEffect(() => {
    void search(q);
  }, [q, search]);

  // Only community-dance events carry the open-band flag; clear it when the event changes away.
  useEffect(() => {
    if (!isCommunityDance) setIsOpenBand(false);
  }, [isCommunityDance]);

  async function openDoorRecord() {
    if (!eventId) return setMessage("Pick an event first");
    const res = await fetch(`/api/events/${eventId}/door-record`, { method: "POST" });
    if (!res.ok) return setMessage("Could not open door record");
    const data = await res.json();
    setMessage(
      `Door record open for this event (${data.doorRecord.id.slice(0, 8)}…) — the Gate page (FS) enters money`,
    );
  }

  const extras = () => {
    const children = Number(childrenCount) || 0;
    return {
      ...(children > 0 ? { childrenCount: children } : {}),
      ...(isCommunityDance && isOpenBand ? { isOpenBand: true } : {}),
    };
  };

  function resetForms() {
    setQ("");
    setCandidates([]);
    setNewFirst("");
    setNewLast("");
    setNewDisplay("");
    setNewEmail("");
    setNewPhone("");
    setChildrenCount("");
    setIsOpenBand(false);
  }

  async function record(body: unknown, label: string, successNote?: string) {
    if (!eventId) return setMessage("Pick an event first");
    const res = await fetch(`/api/events/${eventId}/attendance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const b = await res.json().catch(() => null);
      setMessage(b?.error?.message ?? "Failed");
      return;
    }
    setMessage(successNote ?? `Recorded: ${label}`);
    resetForms();
    void loadRoster(eventId, rosterSort);
  }

  function checkInExisting(c: Candidate) {
    void record({ contactId: c.id, ...extras() }, c.displayName);
  }

  function recordNewContact() {
    const hasContactInfo = newEmail.trim() || newPhone.trim();
    const label = `${newFirst} ${newLast}`.trim();
    void record(
      {
        newContact: {
          firstName: newFirst,
          ...(newLast.trim() ? { lastName: newLast.trim() } : {}),
          ...(newDisplay.trim() ? { displayNameOverride: newDisplay.trim() } : {}),
          ...(newEmail.trim() ? { email: newEmail.trim() } : {}),
          ...(newPhone.trim() ? { phone: newPhone.trim() } : {}),
        },
        ...extras(),
      },
      label,
      hasContactInfo
        ? undefined
        : `Recorded: ${label} — no email or phone on file, flagged for follow-up.`,
    );
  }

  async function saveCounts() {
    if (!eventId) return setMessage("Pick an event first");
    const res = await fetch(`/api/events/${eventId}/checkin-counts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        compCount: Number(compCount) || 0,
        giftCardRedemptionCount: Number(giftCount) || 0,
      }),
    });
    if (!res.ok) {
      const b = await res.json().catch(() => null);
      return setMessage(b?.error?.message ?? "Could not save counts");
    }
    setMessage("Comp / gift-card counts saved — the FS confirms these on the Gate page.");
  }

  return (
    <main style={{ padding: 24, maxWidth: 720 }}>
      <h1>Door check-in</h1>
      <label>
        Event:{" "}
        <select value={eventId} onChange={(e) => setEventId(e.target.value)}>
          <option value="">— select —</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.eventDate}
              {e.label ? ` — ${e.label}` : ""}
            </option>
          ))}
        </select>
      </label>

      <p>
        <button onClick={openDoorRecord} disabled={!eventId}>
          Open door record for this event
        </button>
      </p>

      {message && <p>{message}</p>}

      {/* Per-check-in extras applied to the next check-in below. */}
      <fieldset style={{ marginTop: 8 }}>
        <legend>This check-in</legend>
        <label>
          Children with this person:{" "}
          <input
            type="number"
            min={0}
            value={childrenCount}
            onChange={(e) => setChildrenCount(e.target.value)}
            style={{ width: 64 }}
          />
        </label>
        {isCommunityDance && (
          <label style={{ marginLeft: 16 }}>
            <input
              type="checkbox"
              checked={isOpenBand}
              onChange={(e) => setIsOpenBand(e.target.checked)}
            />{" "}
            Open-band musician (comped)
          </label>
        )}
      </fieldset>

      <h2>Search</h2>
      <input
        placeholder="Type a name…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ padding: 8, width: "100%" }}
      />
      <ul>
        {candidates.map((c) => (
          <li key={c.id}>
            {c.displayName} <small>({c.emails.join(", ") || "no email"})</small>{" "}
            <button onClick={() => checkInExisting(c)}>Check in</button>
          </li>
        ))}
      </ul>

      <h2>No match</h2>
      <div style={{ display: "grid", gap: 6, maxWidth: 360 }}>
        <input
          placeholder="First name"
          value={newFirst}
          onChange={(e) => setNewFirst(e.target.value)}
        />
        <input
          placeholder="Last name"
          value={newLast}
          onChange={(e) => setNewLast(e.target.value)}
        />
        <input
          placeholder={`Display name (default: ${`${newFirst} ${newLast}`.trim() || "First Last"})`}
          value={newDisplay}
          onChange={(e) => setNewDisplay(e.target.value)}
        />
        <input
          placeholder="Email (optional)"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
        />
        <input
          placeholder="Phone (optional)"
          value={newPhone}
          onChange={(e) => setNewPhone(e.target.value)}
        />
        <button onClick={recordNewContact} disabled={!newFirst.trim()}>
          Create + check in
        </button>
        <button onClick={() => record({ unmatched: true }, "unmatched")}>
          Declined / unmatched
        </button>
      </div>

      <h2>Comp &amp; gift-card counts</h2>
      <p style={{ margin: "4px 0", color: "#555" }}>
        <small>Recorded here by the Door Attendant; the FS confirms them on the Gate page.</small>
      </p>
      <div style={{ display: "grid", gap: 6, maxWidth: 360 }}>
        <label>
          Comps (admitted free):{" "}
          <input
            type="number"
            min={0}
            value={compCount}
            onChange={(e) => setCompCount(e.target.value)}
            style={{ width: 64 }}
          />
        </label>
        <label>
          Gift cards redeemed:{" "}
          <input
            type="number"
            min={0}
            value={giftCount}
            onChange={(e) => setGiftCount(e.target.value)}
            style={{ width: 64 }}
          />
        </label>
        <button onClick={saveCounts} disabled={!eventId}>
          Save counts
        </button>
      </div>

      <h2>Checked in ({roster.length})</h2>
      <p style={{ margin: "4px 0" }}>
        Sort:{" "}
        <button onClick={() => setRosterSort("first")} disabled={rosterSort === "first"}>
          First name
        </button>{" "}
        <button onClick={() => setRosterSort("last")} disabled={rosterSort === "last"}>
          Last name
        </button>
      </p>
      <ol>
        {roster.map((a) => (
          <li key={a.id}>
            {a.displayName ?? <em>unmatched</em>}
            {a.childrenCount > 0 ? ` (+${a.childrenCount})` : ""}
            {a.isOpenBand ? " — open band" : ""}
          </li>
        ))}
      </ol>
    </main>
  );
}
