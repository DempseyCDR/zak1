"use client";

import { useCallback, useEffect, useState } from "react";

type EventRow = { id: string; eventDate: string };
type Performer = { id: string; displayName: string };
type Booking = {
  id: string;
  performerId: string;
  performerType: string;
  payCents: number;
  requiresCheck: boolean;
  isDonated: boolean;
};

const TYPES = [
  "caller",
  "lead_musician",
  "open_band_musician",
  "sound_tech",
  "instructor",
] as const;

export default function BookingsPage() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [performers, setPerformers] = useState<Performer[]>([]);
  const [eventId, setEventId] = useState("");
  const [performerId, setPerformerId] = useState("");
  const [performerType, setPerformerType] = useState<string>("caller");
  const [pay, setPay] = useState("");
  const [isDonated, setIsDonated] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/events").then((r) => r.json()).then((d) => setEvents(d.items ?? []));
    void fetch("/api/performers").then((r) => r.json()).then((d) => setPerformers(d.items ?? []));
  }, []);

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

  return (
    <main style={{ padding: 24, maxWidth: 760 }}>
      <h1>Bookings</h1>
      <label>
        Event:{" "}
        <select value={eventId} onChange={(e) => setEventId(e.target.value)}>
          <option value="">— select —</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>{e.eventDate}</option>
          ))}
        </select>
      </label>

      <ul>
        {bookings.map((b) => (
          <li key={b.id}>
            {b.performerType} — ${(b.payCents / 100).toFixed(2)}
            {b.isDonated ? " (donated)" : ""} {b.requiresCheck ? "• check" : ""}
          </li>
        ))}
      </ul>
      <p><strong>Performer total:</strong> ${total.toFixed(2)}</p>

      <h2>Add booking</h2>
      <form onSubmit={book} style={{ display: "grid", gap: 6, maxWidth: 420 }}>
        <select value={performerId} onChange={(e) => setPerformerId(e.target.value)}>
          <option value="">— performer —</option>
          {performers.map((p) => (
            <option key={p.id} value={p.id}>{p.displayName}</option>
          ))}
        </select>
        <select value={performerType} onChange={(e) => setPerformerType(e.target.value)}>
          {TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <input placeholder="Pay (blank = standard rate)" value={pay} onChange={(e) => setPay(e.target.value)} />
        <label>
          <input type="checkbox" checked={isDonated} onChange={(e) => setIsDonated(e.target.checked)} /> Donated
        </label>
        <button type="submit" disabled={!eventId || !performerId}>Book</button>
        {error && <p style={{ color: "crimson" }}>{error}</p>}
      </form>
    </main>
  );
}
