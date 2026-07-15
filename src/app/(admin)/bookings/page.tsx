"use client";

import { useCallback, useEffect, useState } from "react";

type EventRow = { id: string; eventDate: string };
type Series = { id: string; key: string; name: string };
type Performer = { id: string; displayName: string };

/** ISO date one month before today (FR-013 default recency window). */
function oneMonthAgoIso(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
}
type Booking = {
  id: string;
  performerId: string;
  performerName: string;
  performerType: string;
  payCents: number;
  requiresCheck: boolean;
  isDonated: boolean;
};

const TYPES = [
  "caller",
  "lead_musician",
  "musician",
  "open_band_musician",
  "sound_tech",
  "instructor",
] as const;

export default function BookingsPage() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [series, setSeries] = useState<Series[]>([]);
  const [performers, setPerformers] = useState<Performer[]>([]);
  const [eventId, setEventId] = useState("");
  const [includeOlder, setIncludeOlder] = useState(false);
  const [performerId, setPerformerId] = useState("");
  const [performerType, setPerformerType] = useState<string>("caller");
  const [pay, setPay] = useState("");
  const [isDonated, setIsDonated] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // Inline "new event" (FR-014)
  const [newSeriesKey, setNewSeriesKey] = useState("");
  const [newDate, setNewDate] = useState("");
  // Book a band (feature 008)
  const [bands, setBands] = useState<{ id: string; name: string }[]>([]);
  const [bandId, setBandId] = useState("");
  const [bandMessage, setBandMessage] = useState<string | null>(null);

  // FR-012/013: most-recent-first, default to events within the last month unless overridden.
  const loadEvents = useCallback(async (older: boolean) => {
    const qs = older ? "" : `?from=${oneMonthAgoIso()}`;
    const res = await fetch(`/api/events${qs}`);
    const data = await res.json();
    const items: EventRow[] = (data.items ?? []).sort((a: EventRow, b: EventRow) =>
      b.eventDate.localeCompare(a.eventDate),
    );
    setEvents(items);
  }, []);

  useEffect(() => {
    void loadEvents(includeOlder);
  }, [includeOlder, loadEvents]);

  useEffect(() => {
    void fetch("/api/performers")
      .then((r) => r.json())
      .then((d) => setPerformers(d.items ?? []));
    void fetch("/api/series")
      .then((r) => r.json())
      .then((d) => {
        setSeries(d.items ?? []);
        if (d.items?.[0]) setNewSeriesKey(d.items[0].key);
      });
    void fetch("/api/bands")
      .then((r) => r.json())
      .then((d) => setBands(d.items ?? []));
  }, []);

  async function createInlineEvent() {
    if (!newSeriesKey || !newDate) return;
    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seriesKey: newSeriesKey, eventDate: newDate }),
    });
    if (!res.ok) {
      setError("Failed to create event");
      return;
    }
    const ev = await res.json();
    setNewDate("");
    // include older so a back-dated new event is visible, then select it
    if (ev.eventDate < oneMonthAgoIso()) setIncludeOlder(true);
    await loadEvents(ev.eventDate < oneMonthAgoIso() ? true : includeOlder);
    setEventId(ev.id);
  }

  const loadBookings = useCallback(async (id: string) => {
    if (!id) return;
    const res = await fetch(`/api/events/${id}/bookings`);
    const data = await res.json();
    setBookings(data.bookings ?? []);
    setTotal(data.performerTotal ?? 0);
  }, []);

  useEffect(() => {
    void loadBookings(eventId);
  }, [eventId, loadBookings]);

  async function book(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch(`/api/events/${eventId}/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        performerId,
        performerType,
        ...(pay ? { pay: Number(pay) } : {}),
        ...(isDonated ? { isDonated: true } : {}),
      }),
    });
    if (!res.ok) {
      const b = await res.json().catch(() => null);
      setError(b?.error?.message ?? "Failed");
      return;
    }
    setPay("");
    setIsDonated(false);
    void loadBookings(eventId);
  }

  async function bookWholeBand() {
    if (!eventId || !bandId) return;
    setBandMessage(null);
    const res = await fetch(`/api/events/${eventId}/book-band`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bandId }),
    });
    if (!res.ok) {
      const b = await res.json().catch(() => null);
      setBandMessage(b?.error?.message ?? "Failed to book band");
      return;
    }
    const r = await res.json();
    setBandMessage(
      `Booked ${r.createdCount} member(s)${r.skippedCount ? `, skipped ${r.skippedCount} already booked` : ""}. Pay defaults to the series musician rate — adjust individual bookings below if needed.`,
    );
    void loadBookings(eventId);
  }

  async function removeBooking(bookingId: string) {
    const res = await fetch(`/api/bookings/${bookingId}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Failed to remove booking");
      return;
    }
    void loadBookings(eventId);
  }

  return (
    <main style={{ padding: 24, maxWidth: 760 }}>
      <h1>Bookings</h1>
      <label>
        Event:{" "}
        <select value={eventId} onChange={(e) => setEventId(e.target.value)}>
          <option value="">— select —</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.eventDate}
            </option>
          ))}
        </select>
      </label>
      <label style={{ marginLeft: 12 }}>
        <input
          type="checkbox"
          checked={includeOlder}
          onChange={(e) => setIncludeOlder(e.target.checked)}
        />{" "}
        include events &gt; 1 month old
      </label>

      <fieldset style={{ marginTop: 12, maxWidth: 420 }}>
        <legend>New event</legend>
        <select value={newSeriesKey} onChange={(e) => setNewSeriesKey(e.target.value)}>
          {series.map((s) => (
            <option key={s.id} value={s.key}>
              {s.name}
            </option>
          ))}
        </select>{" "}
        <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />{" "}
        <button onClick={createInlineEvent} disabled={!newSeriesKey || !newDate}>
          Create + select
        </button>
      </fieldset>

      <fieldset style={{ marginTop: 12, maxWidth: 420 }}>
        <legend>Book a band</legend>
        <select value={bandId} onChange={(e) => setBandId(e.target.value)}>
          <option value="">— band —</option>
          {bands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>{" "}
        <button onClick={bookWholeBand} disabled={!eventId || !bandId}>
          Book whole band
        </button>
        {bandMessage && <p style={{ color: "#333" }}>{bandMessage}</p>}
      </fieldset>

      <ul>
        {bookings.map((b) => (
          <li key={b.id}>
            {b.performerName} — {b.performerType} — ${(b.payCents / 100).toFixed(2)}
            {b.isDonated ? " (donated)" : ""} {b.requiresCheck ? "• check" : ""}{" "}
            <button onClick={() => removeBooking(b.id)}>Remove</button>
          </li>
        ))}
      </ul>
      <p>
        <strong>Performer total:</strong> ${total.toFixed(2)}
      </p>

      <h2>Add booking</h2>
      <form onSubmit={book} style={{ display: "grid", gap: 6, maxWidth: 420 }}>
        <select value={performerId} onChange={(e) => setPerformerId(e.target.value)}>
          <option value="">— performer —</option>
          {performers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.displayName}
            </option>
          ))}
        </select>
        <select value={performerType} onChange={(e) => setPerformerType(e.target.value)}>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input
          placeholder="Pay (blank = standard rate)"
          value={pay}
          onChange={(e) => setPay(e.target.value)}
        />
        <label>
          <input
            type="checkbox"
            checked={isDonated}
            onChange={(e) => setIsDonated(e.target.checked)}
          />{" "}
          Donated
        </label>
        <button type="submit" disabled={!eventId || !performerId}>
          Book
        </button>
        {error && <p style={{ color: "crimson" }}>{error}</p>}
      </form>
    </main>
  );
}
