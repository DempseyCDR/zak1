"use client";

import { useCallback, useEffect, useState } from "react";

type Venue = { id: string; name: string };
type Series = { id: string; key: string; name: string };
type VenueRent = {
  id: string;
  venueId: string;
  seriesId: string | null;
  amountCents: number;
  effectiveDate: string;
};

// Feature 011: venue rent = default (no series) + series-at-venue overrides, effective-dated.
// Resolution precedence for an event: per-event override → series-at-venue → venue default → 0.
export default function VenueRentsPage() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [venueId, setVenueId] = useState("");
  const [seriesKey, setSeriesKey] = useState(""); // "" = venue default
  const [amount, setAmount] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().slice(0, 10));
  const [rents, setRents] = useState<VenueRent[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/venues")
      .then((r) => r.json())
      .then((d: { items: Venue[] }) => {
        setVenues(d.items);
        if (d.items[0]) setVenueId(d.items[0].id);
      });
    void fetch("/api/series")
      .then((r) => r.json())
      .then((d: { items: Series[] }) => setSeriesList(d.items));
  }, []);

  const loadRents = useCallback(async () => {
    if (!venueId) return;
    const r = await fetch(`/api/venue-rents?venueId=${venueId}`);
    const d = await r.json();
    setRents(d.items ?? []);
  }, [venueId]);

  useEffect(() => {
    void loadRents();
  }, [loadRents]);

  const seriesName = (id: string | null) =>
    id === null ? "— venue default —" : (seriesList.find((s) => s.id === id)?.name ?? id);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const res = await fetch("/api/venue-rents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        venueId,
        ...(seriesKey ? { seriesKey } : {}),
        amount: Number(amount),
        effectiveDate,
      }),
    });
    if (res.ok) {
      setMessage("Saved.");
      setAmount("");
      void loadRents();
    } else {
      setMessage((await res.json()).error?.message ?? "Failed");
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 720 }}>
      <h1>Venue rents</h1>
      <p style={{ color: "#555" }}>
        Effective-dated rent per venue. Leave the series as “venue default” for the venue’s base
        rate, or pick a series for a series-at-venue override. An event resolves: per-event override
        → series-at-venue → venue default → 0. A new entry supersedes earlier ones from its
        effective date.
      </p>

      <form onSubmit={submit} style={{ display: "grid", gap: 10, maxWidth: 360 }}>
        <label>
          Venue
          <br />
          <select value={venueId} onChange={(e) => setVenueId(e.target.value)}>
            {venues.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Series
          <br />
          <select value={seriesKey} onChange={(e) => setSeriesKey(e.target.value)}>
            <option value="">— venue default —</option>
            {seriesList.map((s) => (
              <option key={s.id} value={s.key}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Amount ($)
          <br />
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </label>
        <label>
          Effective date
          <br />
          <input
            type="date"
            value={effectiveDate}
            onChange={(e) => setEffectiveDate(e.target.value)}
            required
          />
        </label>
        <button type="submit">Save rent</button>
      </form>

      {message && <p>{message}</p>}

      <h2>Rents for this venue</h2>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: 6 }}>Scope</th>
            <th style={{ textAlign: "left", padding: 6 }}>Amount</th>
            <th style={{ textAlign: "left", padding: 6 }}>Effective</th>
          </tr>
        </thead>
        <tbody>
          {rents.map((r) => (
            <tr key={r.id}>
              <td style={{ padding: 6 }}>{seriesName(r.seriesId)}</td>
              <td style={{ padding: 6 }}>${(r.amountCents / 100).toFixed(2)}</td>
              <td style={{ padding: 6 }}>{r.effectiveDate}</td>
            </tr>
          ))}
          {rents.length === 0 && (
            <tr>
              <td style={{ padding: 6, color: "#777" }} colSpan={3}>
                No rents set for this venue.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
