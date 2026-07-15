"use client";

import { useCallback, useEffect, useState } from "react";

type EventRow = { id: string; eventDate: string; seriesId: string; label: string | null };
type Candidate = { id: string; displayName: string; membershipStatus: string; emails: string[] };

export default function CheckinPage() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [eventId, setEventId] = useState<string>("");
  const [q, setQ] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");

  useEffect(() => {
    void fetch("/api/events")
      .then((r) => r.json())
      .then((d) => setEvents(d.items ?? []));
  }, []);

  const search = useCallback(async (query: string) => {
    if (!query.trim()) return setCandidates([]);
    const res = await fetch(`/api/attendance/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    setCandidates(data.items ?? []);
  }, []);

  useEffect(() => {
    void search(q);
  }, [q, search]);

  async function openDoorRecord() {
    if (!eventId) return setMessage("Pick an event first");
    const res = await fetch(`/api/events/${eventId}/door-record`, { method: "POST" });
    if (!res.ok) return setMessage("Could not open door record");
    const data = await res.json();
    setMessage(
      `Door record open for this event (${data.doorRecord.id.slice(0, 8)}…) — use the Gate page to enter money`,
    );
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
    setQ("");
    setCandidates([]);
    setNewName("");
    setNewEmail("");
    setNewPhone("");
  }

  function recordNewContact() {
    const hasContactInfo = newEmail.trim() || newPhone.trim();
    void record(
      {
        newContact: {
          firstName: newName,
          ...(newEmail.trim() ? { email: newEmail.trim() } : {}),
          ...(newPhone.trim() ? { phone: newPhone.trim() } : {}),
        },
      },
      newName,
      hasContactInfo
        ? undefined
        : `Recorded: ${newName} — no email or phone on file, flagged for follow-up.`,
    );
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
            <button onClick={() => record({ contactId: c.id }, c.displayName)}>Check in</button>
          </li>
        ))}
      </ul>

      <h2>No match</h2>
      <div style={{ display: "grid", gap: 6, maxWidth: 360 }}>
        <input placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} />
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
        <button onClick={recordNewContact}>Create + check in</button>
        <button onClick={() => record({ unmatched: true }, "unmatched")}>
          Declined / unmatched
        </button>
      </div>
    </main>
  );
}
