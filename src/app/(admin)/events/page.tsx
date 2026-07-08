"use client";

import { useCallback, useEffect, useState } from "react";
import { formatWallClock } from "@/server/domain/public/wallClock";

type Series = { id: string; key: string; name: string };
type Group = { id: string; name: string; kind: string | null };
type EventRow = {
  id: string;
  seriesId: string;
  groupId: string | null;
  eventDate: string;
  chargesAdmission: boolean;
  rentCents: number | null;
  label: string | null;
  startTime: string | null;
  description: string | null;
};

export default function EventsPage() {
  const [series, setSeries] = useState<Series[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [seriesKey, setSeriesKey] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [chargesAdmission, setChargesAdmission] = useState(true);
  const [label, setLabel] = useState("");
  const [startTime, setStartTime] = useState("");
  const [description, setDescription] = useState("");
  const [groupId, setGroupId] = useState("");
  const [groupName, setGroupName] = useState("");
  const [groupKind, setGroupKind] = useState("");
  const [rentEventId, setRentEventId] = useState("");
  const [rentAmount, setRentAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function setEventRent(clear: boolean) {
    if (!rentEventId) return;
    const rentCents = clear ? null : Math.round(Number(rentAmount) * 100);
    const res = await fetch(`/api/events/${rentEventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rentCents }),
    });
    if (res.ok) {
      setRentAmount("");
      void loadEvents();
    } else {
      setError((await res.json().catch(() => null))?.error?.message ?? "Failed to set rent");
    }
  }

  const loadEvents = useCallback(async () => {
    const res = await fetch("/api/events");
    setEvents((await res.json()).items ?? []);
  }, []);
  const loadGroups = useCallback(async () => {
    const res = await fetch("/api/event-groups");
    setGroups((await res.json()).items ?? []);
  }, []);

  useEffect(() => {
    void fetch("/api/series").then((r) => r.json()).then((d) => {
      setSeries(d.items ?? []);
      if (d.items?.[0]) setSeriesKey(d.items[0].key);
    });
    void loadGroups();
    void loadEvents();
  }, [loadEvents, loadGroups]);

  const seriesKeyById = (id: string) => series.find((s) => s.id === id)?.key ?? id;

  async function createEvent(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        seriesKey,
        eventDate,
        chargesAdmission,
        ...(groupId ? { groupId } : {}),
        ...(label.trim() ? { label: label.trim() } : {}),
        ...(startTime ? { startTime } : {}),
        ...(description.trim() ? { description: description.trim() } : {}),
      }),
    });
    if (!res.ok) {
      setError((await res.json().catch(() => null))?.error?.message ?? "Failed to create event");
      return;
    }
    setEventDate("");
    setLabel("");
    setStartTime("");
    setDescription("");
    void loadEvents();
  }

  async function createGroup() {
    if (!groupName.trim()) return;
    const res = await fetch("/api/event-groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: groupName, ...(groupKind.trim() ? { kind: groupKind.trim() } : {}) }),
    });
    if (res.ok) {
      const g = await res.json();
      setGroupName("");
      await loadGroups();
      setGroupId(g.id);
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 760 }}>
      <h1>Events</h1>

      <ul>
        {events.map((ev) => (
          <li key={ev.id}>
            {ev.eventDate}
            {ev.startTime ? ` ${formatWallClock(ev.startTime)}` : ""} — {seriesKeyById(ev.seriesId)}
            {ev.label ? ` · ${ev.label}` : ""}
            {ev.chargesAdmission ? "" : " (free)"}
            {ev.groupId ? ` · group ${groups.find((g) => g.id === ev.groupId)?.name ?? ev.groupId}` : ""}
            {ev.rentCents != null ? ` · rent $${(ev.rentCents / 100).toFixed(2)}` : ""}
          </li>
        ))}
        {events.length === 0 && <li style={{ color: "#888" }}>No events</li>}
      </ul>

      <h2>Create event</h2>
      <form onSubmit={createEvent} style={{ display: "grid", gap: 6, maxWidth: 420 }}>
        <select value={seriesKey} onChange={(e) => setSeriesKey(e.target.value)}>
          {series.map((s) => (
            <option key={s.id} value={s.key}>{s.name}</option>
          ))}
        </select>
        <input
          type="date"
          value={eventDate}
          onChange={(e) => setEventDate(e.target.value)}
        />
        <input
          placeholder="Label (optional, e.g. Afternoon)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <label>
          Start time (optional)
          <br />
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </label>
        <textarea
          placeholder="Description (optional, shown on the public site)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />
        <label>
          <input
            type="checkbox"
            checked={chargesAdmission}
            onChange={(e) => setChargesAdmission(e.target.checked)}
          />{" "}
          Charges admission
        </label>
        <select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
          <option value="">— no group —</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
        <button type="submit" disabled={!seriesKey || !eventDate}>Create event</button>
        {error && <p style={{ color: "crimson" }}>{error}</p>}
      </form>

      <h2>New event group</h2>
      <div style={{ display: "grid", gap: 6, maxWidth: 420 }}>
        <input placeholder="Group name" value={groupName} onChange={(e) => setGroupName(e.target.value)} />
        <input
          placeholder="Category (optional)"
          value={groupKind}
          onChange={(e) => setGroupKind(e.target.value)}
        />
        <button onClick={createGroup}>Create group</button>
      </div>

      <h2>Per-event rent override</h2>
      <p style={{ color: "#666", maxWidth: 520 }}>
        Overrides an event&apos;s resolved rent (or sets rent directly when the event has no venue).
        Clear to fall back to the venue/series rent. Manage standard rates under Venue rents.
      </p>
      <div style={{ display: "grid", gap: 6, maxWidth: 420 }}>
        <select value={rentEventId} onChange={(e) => setRentEventId(e.target.value)}>
          <option value="">— select an event —</option>
          {events.map((ev) => (
            <option key={ev.id} value={ev.id}>
              {ev.eventDate} — {seriesKeyById(ev.seriesId)}
            </option>
          ))}
        </select>
        <input
          type="number"
          step="0.01"
          placeholder="Rent ($)"
          value={rentAmount}
          onChange={(e) => setRentAmount(e.target.value)}
        />
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => setEventRent(false)} disabled={!rentEventId || !rentAmount}>
            Set rent
          </button>
          <button onClick={() => setEventRent(true)} disabled={!rentEventId}>
            Clear override
          </button>
        </div>
      </div>
    </main>
  );
}
