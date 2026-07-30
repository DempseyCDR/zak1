"use client";
import { apiFetch } from "@/app/apiFetch";

import { useCallback, useEffect, useState } from "react";
import { BookingModal } from "@/app/(admin)/_modals/BookingModal";
import { EventModal } from "@/app/(admin)/_modals/EventModal";

type Series = { id: string; key: string; name: string };
type Performer = { id: string; displayName: string };
type Band = { id: string; name: string };
type Venue = { id: string; name: string; shortName: string | null };
type BookingLine = {
  bookingId: string;
  performerId: string;
  performer: string;
  type: string;
  status: string;
};
type ReportRow = {
  eventId: string;
  date: string;
  series: string;
  venueShortName: string | null;
  hasSoundTech: boolean;
  band: string | null;
  bandId: string | null; // feature 024 US2: the band on the event → offer a re-point
  cancelled: boolean;
  bookings: BookingLine[];
};

const MUSICIAN_TYPES = new Set(["lead_musician", "musician", "open_band_musician"]);
const LETTER: Record<string, string> = {
  proposed: "P",
  requested: "R",
  tentative: "T",
  confirmed: "C",
  declined: "D",
};

// Feature 020 US3 (FR-003): the LETTER carries the meaning (accessible); color merely reinforces it.
// Inline styles to match the codebase (no stylesheet). A class hook is kept for future theming.
const STATUS_COLOR: Record<string, string> = {
  proposed: "#777",
  requested: "#b8860b",
  tentative: "#c060c0",
  confirmed: "#2e7d32",
  declined: "#b00020",
};
function StatusLetter({ status }: { status: string }) {
  return (
    <span
      className={`booking-status booking-status--${status}`}
      title={status}
      style={{ color: STATUS_COLOR[status] ?? "#000", fontWeight: 700, marginLeft: 2 }}
    >
      {LETTER[status] ?? "?"}
    </span>
  );
}

type BookingModalState =
  | { mode: "create"; eventId: string; eventDate: string; role: string }
  | {
      mode: "edit" | "readonly";
      eventId: string;
      eventDate: string;
      booking: {
        id: string;
        performerId: string;
        performer: string;
        type: string;
        payCents: number;
        note: string | null;
        status: string;
      };
    };

type EventModalState = {
  mode: "edit" | "readonly";
  event: {
    id: string;
    seriesKey: string;
    eventDate: string;
    startTime: string | null;
    venueId: string | null;
    rentCents: number | null;
    label: string | null;
    description: string | null;
  };
};

export default function BookingsReportPage() {
  const [series, setSeries] = useState<Series[]>([]);
  const [performers, setPerformers] = useState<Performer[]>([]);
  const [bands, setBands] = useState<Band[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [caps, setCaps] = useState({ bookingWrite: false, eventWrite: false });

  const [seriesKey, setSeriesKey] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [caller, setCaller] = useState("");
  const [band, setBand] = useState("");
  const [musician, setMusician] = useState("");
  const [sort, setSort] = useState<"asc" | "desc">("asc");

  const [bookingModal, setBookingModal] = useState<BookingModalState | null>(null);
  const [eventModal, setEventModal] = useState<EventModalState | null>(null);

  useEffect(() => {
    const j = (u: string) => apiFetch(u).then((r) => r.json());
    void j("/api/series").then((d) => setSeries(d.items ?? []));
    void j("/api/performers").then((d) => setPerformers(d.items ?? []));
    void j("/api/bands").then((d) => setBands(d.items ?? []));
    void j("/api/venues").then((d) => setVenues(d.items ?? []));
    void j("/api/me/capabilities").then((d) =>
      setCaps({ bookingWrite: !!d.bookingWrite, eventWrite: !!d.eventWrite }),
    );
  }, []);

  const load = useCallback(async () => {
    const p = new URLSearchParams();
    if (seriesKey) p.set("series", seriesKey);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (caller) p.set("caller", caller);
    if (band) p.set("band", band);
    if (musician) p.set("musician", musician);
    p.set("sort", sort);
    const res = await apiFetch(`/api/bookings/report?${p.toString()}`);
    setRows((await res.json()).rows ?? []);
  }, [seriesKey, from, to, caller, band, musician, sort]);

  useEffect(() => {
    void load();
  }, [load]);

  const seriesKeyById = new Map(series.map((s) => [s.id, s.key]));

  async function openBookingEdit(eventId: string, eventDate: string, bookingId: string) {
    const res = await apiFetch(`/api/events/${eventId}/bookings`);
    const body = await res.json();
    const b = (body.bookings ?? []).find((x: { id: string }) => x.id === bookingId);
    if (!b) return;
    setBookingModal({
      mode: caps.bookingWrite ? "edit" : "readonly",
      eventId,
      eventDate,
      booking: {
        id: b.id,
        performerId: b.performerId,
        performer: b.performerName,
        type: b.performerType,
        payCents: b.payCents,
        note: b.note ?? null,
        status: b.status,
      },
    });
  }

  async function openEvent(eventId: string) {
    const res = await apiFetch(`/api/events/${eventId}`);
    if (!res.ok) return;
    const e = await res.json();
    setEventModal({
      mode: caps.eventWrite ? "edit" : "readonly",
      event: {
        id: e.id,
        seriesKey: seriesKeyById.get(e.seriesId) ?? "",
        eventDate: e.eventDate,
        startTime: e.startTime ?? null,
        venueId: e.venueId ?? null,
        rentCents: e.rentCents ?? null,
        label: e.label ?? null,
        description: e.description ?? null,
      },
    });
  }

  return (
    <main style={{ padding: 24, maxWidth: 1000 }}>
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
        <button type="button" onClick={() => setSort((s) => (s === "asc" ? "desc" : "asc"))}>
          Sort: date {sort === "asc" ? "↑" : "↓"}
        </button>
      </fieldset>

      <table style={{ marginTop: 12, borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", paddingRight: 12 }}>Date</th>
            <th style={{ textAlign: "left", paddingRight: 12 }}>Venue</th>
            <th style={{ textAlign: "left", paddingRight: 12 }}>Series</th>
            <th style={{ textAlign: "left", paddingRight: 12 }}>Caller</th>
            <th style={{ textAlign: "left", paddingRight: 12 }}>Musicians</th>
            <th style={{ textAlign: "left" }}>Sound tech</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const withEvent = (b: BookingLine) => ({ ...b, eventId: r.eventId });
            const callerLines = r.bookings.filter((b) => b.type === "caller").map(withEvent);
            const soundLines = r.bookings.filter((b) => b.type === "sound_tech").map(withEvent);
            const musicianLines = r.bookings
              .filter((b) => MUSICIAN_TYPES.has(b.type))
              .map(withEvent);
            return (
              <tr key={r.eventId} style={{ borderTop: "1px solid #eee" }}>
                <td style={{ paddingRight: 12 }}>
                  <button
                    type="button"
                    onClick={() => void openEvent(r.eventId)}
                    title="Manage event"
                  >
                    {r.date}
                    {r.cancelled ? " (cancelled)" : ""}
                  </button>
                </td>
                <td style={{ paddingRight: 12 }}>{r.venueShortName ?? "—"}</td>
                <td style={{ paddingRight: 12 }}>{r.series}</td>
                <td style={{ paddingRight: 12 }}>
                  {callerLines.map((b) => (
                    <BookingSlot
                      key={b.bookingId}
                      line={b}
                      onClick={() => void openBookingEdit(r.eventId, r.date, b.bookingId)}
                    />
                  ))}
                  {caps.bookingWrite && callerLines.length === 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setBookingModal({
                          mode: "create",
                          eventId: r.eventId,
                          eventDate: r.date,
                          role: "caller",
                        })
                      }
                    >
                      + add caller
                    </button>
                  )}
                </td>
                <td style={{ paddingRight: 12 }}>
                  {musicianLines.map((b) => (
                    <BookingSlot
                      key={b.bookingId}
                      line={b}
                      onClick={() => void openBookingEdit(r.eventId, r.date, b.bookingId)}
                    />
                  ))}
                  {caps.bookingWrite && (
                    <button
                      type="button"
                      onClick={() =>
                        setBookingModal({
                          mode: "create",
                          eventId: r.eventId,
                          eventDate: r.date,
                          role: "musician",
                        })
                      }
                    >
                      + add musician
                    </button>
                  )}
                  {caps.bookingWrite && r.bandId && (
                    <BandRepointControl
                      eventId={r.eventId}
                      fromBandId={r.bandId}
                      fromBandName={r.band}
                      bands={bands}
                      onDone={() => void load()}
                    />
                  )}
                </td>
                <td>
                  {r.hasSoundTech ? (
                    <>
                      {soundLines.map((b) => (
                        <BookingSlot
                          key={b.bookingId}
                          line={b}
                          onClick={() => void openBookingEdit(r.eventId, r.date, b.bookingId)}
                        />
                      ))}
                      {caps.bookingWrite && soundLines.length === 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            setBookingModal({
                              mode: "create",
                              eventId: r.eventId,
                              eventDate: r.date,
                              role: "sound_tech",
                            })
                          }
                        >
                          + add sound tech
                        </button>
                      )}
                    </>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {rows.length === 0 && <p style={{ color: "#888" }}>No bookings match.</p>}

      {bookingModal && (
        <BookingModal
          {...bookingModal}
          onClose={() => setBookingModal(null)}
          onSaved={() => void load()}
        />
      )}
      {eventModal && (
        <EventModal
          mode={eventModal.mode}
          event={eventModal.event}
          venues={venues}
          onClose={() => setEventModal(null)}
          onSaved={() => void load()}
        />
      )}
    </main>
  );
}

function BookingSlot({ line, onClick }: { line: BookingLine; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} title="Manage booking" style={{ marginRight: 8 }}>
      {line.performer} <StatusLetter status={line.status} />
    </button>
  );
}

// Feature 024 US2: swap the event's band for another. Unpaid outgoing bookings are removed, any live-paid one
// is kept as a no-show, and the incoming band's roster is booked fresh (all server-side).
function BandRepointControl({
  eventId,
  fromBandId,
  fromBandName,
  bands,
  onDone,
}: {
  eventId: string;
  fromBandId: string;
  fromBandName: string | null;
  bands: Band[];
  onDone: () => void;
}) {
  const [toBandId, setToBandId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const others = bands.filter((b) => b.id !== fromBandId);

  async function repoint() {
    if (!toBandId) return;
    setError(null);
    const res = await apiFetch(`/api/events/${eventId}/repoint-band`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromBandId, toBandId }),
    });
    if (!res.ok) return setError("Could not re-point the band");
    setToBandId("");
    onDone();
  }

  return (
    <div style={{ marginTop: 6 }}>
      <label>
        <small>Re-point {fromBandName ?? "band"} → </small>
        <select
          aria-label="Re-point band to"
          value={toBandId}
          onChange={(e) => setToBandId(e.target.value)}
        >
          <option value="">choose band</option>
          {others.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </label>{" "}
      <button type="button" onClick={() => void repoint()} disabled={!toBandId}>
        Re-point band
      </button>
      {error && (
        <span role="alert" style={{ color: "#b00020", marginLeft: 6 }}>
          {error}
        </span>
      )}
    </div>
  );
}
