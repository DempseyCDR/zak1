"use client";

import { useCallback, useEffect, useState } from "react";

type Venue = { id: string; name: string; address: string; landlordContactId: string | null };
type EventRow = { id: string; eventDate: string; venueId: string | null };
type Contact = { id: string; displayName: string };

export default function VenuesPage() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [eventId, setEventId] = useState("");
  const [venueId, setVenueId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  // Feature 018 (B22): venue landlord contact (search picker, B39 convention).
  const [landlordVenueId, setLandlordVenueId] = useState("");
  const [lq, setLq] = useState("");
  const [lresults, setLresults] = useState<Contact[]>([]);

  useEffect(() => {
    if (!lq.trim()) {
      setLresults([]);
      return;
    }
    void fetch(`/api/contacts?q=${encodeURIComponent(lq)}`)
      .then((r) => r.json())
      .then((d) => setLresults(d.items ?? []));
  }, [lq]);

  async function setLandlord(venue: string, landlordContactId: string | null) {
    const res = await fetch(`/api/venues/${venue}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ landlordContactId }),
    });
    if (!res.ok) {
      setMessage((await res.json().catch(() => null))?.error?.message ?? "Failed to set landlord");
      return;
    }
    setLq("");
    setLresults([]);
    setMessage(landlordContactId ? "Landlord set." : "Landlord cleared.");
    void load();
  }

  const load = useCallback(async () => {
    const [v, e] = await Promise.all([
      fetch("/api/venues").then((r) => r.json()),
      fetch("/api/events").then((r) => r.json()),
    ]);
    setVenues(v.items ?? []);
    setEvents(e.items ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createVenue(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const res = await fetch("/api/venues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, address }),
    });
    if (!res.ok) {
      setMessage("Failed to create venue (name + address required)");
      return;
    }
    setName("");
    setAddress("");
    void load();
  }

  async function assign() {
    if (!eventId) return;
    setMessage(null);
    const res = await fetch(`/api/events/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ venueId: venueId || null }),
    });
    if (!res.ok) {
      setMessage((await res.json().catch(() => null))?.error?.message ?? "Failed to assign venue");
      return;
    }
    setMessage("Venue assigned.");
    void load();
  }

  return (
    <main style={{ padding: 24, maxWidth: 640 }}>
      <h1>Venues</h1>
      <ul>
        {venues.map((v) => (
          <li key={v.id}>
            {v.name} — {v.address}
            {v.landlordContactId ? " · landlord set" : ""}
          </li>
        ))}
        {venues.length === 0 && <li style={{ color: "#888" }}>No venues</li>}
      </ul>

      <h2 style={{ marginTop: 24 }}>Venue landlord</h2>
      <div style={{ display: "grid", gap: 6, maxWidth: 420 }}>
        <select value={landlordVenueId} onChange={(e) => setLandlordVenueId(e.target.value)}>
          <option value="">— venue —</option>
          {venues.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
              {v.landlordContactId ? " (has landlord)" : ""}
            </option>
          ))}
        </select>
        {landlordVenueId && (
          <>
            <input
              placeholder="Search a contact…"
              value={lq}
              onChange={(e) => setLq(e.target.value)}
            />
            <ul>
              {lresults.map((c) => (
                <li key={c.id}>
                  {c.displayName}{" "}
                  <button onClick={() => setLandlord(landlordVenueId, c.id)}>
                    Set as landlord
                  </button>
                </li>
              ))}
            </ul>
            <button onClick={() => setLandlord(landlordVenueId, null)}>Clear landlord</button>
          </>
        )}
      </div>

      <h2>Add venue</h2>
      <form onSubmit={createVenue} style={{ display: "grid", gap: 6, maxWidth: 420 }}>
        <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <input placeholder="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
        <button type="submit">Create venue</button>
      </form>

      <h2 style={{ marginTop: 24 }}>Assign a venue to an event</h2>
      <div style={{ display: "grid", gap: 6, maxWidth: 420 }}>
        <select value={eventId} onChange={(e) => setEventId(e.target.value)}>
          <option value="">— event —</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.eventDate}
            </option>
          ))}
        </select>
        <select value={venueId} onChange={(e) => setVenueId(e.target.value)}>
          <option value="">— (no venue) —</option>
          {venues.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
        <button onClick={assign} disabled={!eventId}>
          Assign
        </button>
      </div>
      {message && <p>{message}</p>}
    </main>
  );
}
