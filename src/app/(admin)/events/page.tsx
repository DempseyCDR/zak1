"use client";

import { useCallback, useEffect, useState } from "react";

type Series = { id: string; key: string; name: string };
type Group = { id: string; name: string; kind: string };
type EventRow = {
  id: string;
  seriesId: string;
  groupId: string | null;
  eventDate: string;
  chargesAdmission: boolean;
};

export default function EventsPage() {
  const [series, setSeries] = useState<Series[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [seriesKey, setSeriesKey] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [chargesAdmission, setChargesAdmission] = useState(true);
  const [groupId, setGroupId] = useState("");
  const [groupName, setGroupName] = useState("");
  const [groupKind, setGroupKind] = useState("weekend");
  const [error, setError] = useState<string | null>(null);

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
      }),
    });
    if (!res.ok) {
      setError((await res.json().catch(() => null))?.error?.message ?? "Failed to create event");
      return;
    }
    setEventDate("");
    void loadEvents();
  }

  async function createGroup() {
    if (!groupName.trim()) return;
    const res = await fetch("/api/event-groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: groupName, kind: groupKind }),
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
            {ev.eventDate} — {seriesKeyById(ev.seriesId)}
            {ev.chargesAdmission ? "" : " (free)"}
            {ev.groupId ? ` · group ${groups.find((g) => g.id === ev.groupId)?.name ?? ev.groupId}` : ""}
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
        <select value={groupKind} onChange={(e) => setGroupKind(e.target.value)}>
          <option value="double_dance">Double Dance</option>
          <option value="weekend">Weekend</option>
          <option value="jane_austen_ball">Jane Austen Ball</option>
          <option value="other">Other</option>
        </select>
        <button onClick={createGroup}>Create group</button>
      </div>
    </main>
  );
}
