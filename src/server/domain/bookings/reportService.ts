import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import { bands, events, series, venues } from "@/server/db/schema";
import type { BookingStatus, PerformerType } from "@/server/db/schema";
import { venueShortNameDefault } from "@/server/domain/venues/venueService";
import { getBookingsForEvent } from "./bookingService";

/**
 * Feature 018 (B24): a read-across-events bookings report for the Booker's talent-distribution planning.
 * Filters compose (AND). Read-only. Cancelled events are INCLUDED, flagged (FR-005). All booking statuses
 * are shown (this is the staff view; the public site is confirmed-only, FR-022).
 */
export type BookingsReportFilters = {
  series?: string; // series key
  from?: string; // YYYY-MM-DD inclusive
  to?: string; // YYYY-MM-DD inclusive
  caller?: string; // performer id
  band?: string; // band id
  musician?: string; // performer id
  sort?: "asc" | "desc"; // by event date; default desc (feature 029, P5-R2; was asc in 020 US1)
};

export type BookingsReportBookingLine = {
  bookingId: string; // feature 020: so the report UI can open THIS booking's modal (US2)
  performerId: string;
  performer: string;
  type: PerformerType;
  status: BookingStatus;
};

export type BookingsReportRow = {
  eventId: string;
  date: string;
  series: string;
  venueShortName: string | null; // feature 020 US1 (FR-002); derived initials when short_name is null
  hasSoundTech: boolean; // feature 020 US1 (FR-004); false → no sound-tech slot (community_dance)
  caller: string | null;
  band: string | null; // first named band, if any
  bandId: string | null; // feature 024 US2: the band on the event, so the report can offer a re-point
  musicians: string[];
  soundTech: string | null;
  cancelled: boolean;
  bookings: BookingsReportBookingLine[];
};

const MUSICIAN_TYPES: ReadonlySet<PerformerType> = new Set([
  "lead_musician",
  "musician",
  "open_band_musician",
]);

export async function assembleBookingsReport(
  db: Db,
  filters: BookingsReportFilters = {},
): Promise<{ rows: BookingsReportRow[] }> {
  const conds: SQL[] = [];
  if (filters.series) conds.push(eq(series.key, filters.series));
  if (filters.from) conds.push(gte(events.eventDate, filters.from));
  if (filters.to) conds.push(lte(events.eventDate, filters.to));

  const eventRows = await db
    .select({
      id: events.id,
      date: events.eventDate,
      seriesName: series.name,
      hasSoundTech: series.hasSoundTech,
      status: events.status,
      venueName: venues.name,
      venueShort: venues.shortName,
    })
    .from(events)
    .innerJoin(series, eq(series.id, events.seriesId))
    .leftJoin(venues, eq(venues.id, events.venueId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(filters.sort === "asc" ? asc(events.eventDate) : desc(events.eventDate));

  const rows: BookingsReportRow[] = [];
  for (const ev of eventRows) {
    const { bookings } = await getBookingsForEvent(db, ev.id);

    // Filters (AND): only include the event if every supplied id filter matches one of its bookings.
    if (
      filters.caller &&
      !bookings.some((b) => b.performerType === "caller" && b.performerId === filters.caller)
    ) {
      continue;
    }
    if (
      filters.musician &&
      !bookings.some(
        (b) => MUSICIAN_TYPES.has(b.performerType) && b.performerId === filters.musician,
      )
    ) {
      continue;
    }
    if (filters.band && !bookings.some((b) => b.bandId === filters.band)) continue;

    const caller = bookings.find((b) => b.performerType === "caller")?.performerName ?? null;
    const soundTech = bookings.find((b) => b.performerType === "sound_tech")?.performerName ?? null;
    const musicians = bookings
      .filter((b) => MUSICIAN_TYPES.has(b.performerType))
      .map((b) => b.performerName);

    let band: string | null = null;
    const bandId = bookings.find((b) => b.bandId !== null)?.bandId ?? null;
    if (bandId) {
      const bandRow = await db.query.bands.findFirst({ where: eq(bands.id, bandId) });
      band = bandRow?.name ?? null;
    }

    const venueShortName = ev.venueName
      ? (ev.venueShort ?? (venueShortNameDefault(ev.venueName) || null))
      : null;

    rows.push({
      eventId: ev.id,
      date: ev.date,
      series: ev.seriesName,
      venueShortName,
      hasSoundTech: ev.hasSoundTech,
      caller,
      band,
      bandId,
      musicians,
      soundTech,
      cancelled: ev.status === "cancelled",
      bookings: bookings.map((b) => ({
        bookingId: b.id,
        performerId: b.performerId,
        performer: b.performerName,
        type: b.performerType,
        status: b.status,
      })),
    });
  }

  return { rows };
}
