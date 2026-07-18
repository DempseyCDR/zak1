"use client";

import { useCallback, useEffect, useState } from "react";

type Series = { id: string; key: string; name: string };
type Performer = { id: string; displayName: string };
type Band = { id: string; name: string };
type ReportRow = {
  eventId: string;
  date: string;
  series: string;
  caller: string | null;
  band: string | null;
  musicians: string[];
  soundTech: string | null;
  cancelled: boolean;
  bookings: { performer: string; type: string; status: string }[];
};

export default function BookingsReportPage() {
  const [series, setSeries] = useState<Series[]>([]);
  const [performers, setPerformers] = useState<Performer[]>([]);
  const [bands, setBands] = useState<Band[]>([]);
  const [rows, setRows] = useState<ReportRow[]>([]);

  const [seriesKey, setSeriesKey] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [caller, setCaller] = useState("");
  const [band, setBand] = useState("");
  const [musician, setMusician] = useState("");

  useEffect(() => {
    void fetch("/api/series")
      .then((r) => r.json())
      .then((d) => setSeries(d.items ?? []));
    void fetch("/api/performers")
      .then((r) => r.json())
      .then((d) => setPerformers(d.items ?? []));
    void fetch("/api/bands")
      .then((r) => r.json())
      .then((d) => setBands(d.items ?? []));
  }, []);

  const load = useCallback(async () => {
    const p = new URLSearchParams();
    if (seriesKey) p.set("series", seriesKey);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (caller) p.set("caller", caller);
    if (band) p.set("band", band);
    if (musician) p.set("musician", musician);
    const res = await fetch(`/api/bookings/report?${p.toString()}`);
    const data = await res.json();
    setRows(data.rows ?? []);
  }, [seriesKey, from, to, caller, band, musician]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main style={{ padding: 24, maxWidth: 960 }}>
      <h1>Bookings report</h1>
      <p style={{ color: "#555" }}>
        <small>
          All bookings across events (staff planning view; the public site shows only confirmed).
        </small>
      </p>

      <fieldset style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <legend>Filters</legend>
        <select value={seriesKey} onChange={(e) => setSeriesKey(e.target.value)}>
          <option value="">any series</option>
          {series.map((s) => (
            <option key={s.id} value={s.key}>
              {s.name}
            </option>
          ))}
        </select>
        <label>
          from <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          to <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <select value={caller} onChange={(e) => setCaller(e.target.value)}>
          <option value="">any caller</option>
          {performers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.displayName}
            </option>
          ))}
        </select>
        <select value={musician} onChange={(e) => setMusician(e.target.value)}>
          <option value="">any musician</option>
          {performers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.displayName}
            </option>
          ))}
        </select>
        <select value={band} onChange={(e) => setBand(e.target.value)}>
          <option value="">any band</option>
          {bands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </fieldset>

      <table style={{ marginTop: 12, borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", paddingRight: 12 }}>Date</th>
            <th style={{ textAlign: "left", paddingRight: 12 }}>Series</th>
            <th style={{ textAlign: "left", paddingRight: 12 }}>Caller</th>
            <th style={{ textAlign: "left", paddingRight: 12 }}>Band</th>
            <th style={{ textAlign: "left", paddingRight: 12 }}>Musicians</th>
            <th style={{ textAlign: "left", paddingRight: 12 }}>Sound tech</th>
            <th style={{ textAlign: "left" }}>Statuses</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.eventId}>
              <td style={{ paddingRight: 12 }}>
                {r.date}
                {r.cancelled ? " (cancelled)" : ""}
              </td>
              <td style={{ paddingRight: 12 }}>{r.series}</td>
              <td style={{ paddingRight: 12 }}>{r.caller ?? "—"}</td>
              <td style={{ paddingRight: 12 }}>{r.band ?? "—"}</td>
              <td style={{ paddingRight: 12 }}>{r.musicians.join(", ") || "—"}</td>
              <td style={{ paddingRight: 12 }}>{r.soundTech ?? "—"}</td>
              <td>{r.bookings.map((b) => b.status).join(", ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p style={{ color: "#888" }}>No bookings match.</p>}
    </main>
  );
}
