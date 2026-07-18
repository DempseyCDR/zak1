import { and, asc, eq, gte, lte } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import { bands, events, series } from "@/server/db/schema";
import type { BookingStatus, PerformerType } from "@/server/db/schema";
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
};

export type BookingsReportBookingLine = {
  performer: string;
  type: PerformerType;
  status: BookingStatus;
};

export type BookingsReportRow = {
  eventId: string;
  date: string;
  series: string;
  caller: string | null;
  band: string | null; // first named band, if any
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
      status: events.status,
    })
    .from(events)
    .innerJoin(series, eq(series.id, events.seriesId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(asc(events.eventDate));

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
    const bandId = bookings.find((b) => b.bandId !== null)?.bandId;
    if (bandId) {
      const bandRow = await db.query.bands.findFirst({ where: eq(bands.id, bandId) });
      band = bandRow?.name ?? null;
    }

    rows.push({
      eventId: ev.id,
      date: ev.date,
      series: ev.seriesName,
      caller,
      band,
      musicians,
      soundTech,
      cancelled: ev.status === "cancelled",
      bookings: bookings.map((b) => ({
        performer: b.performerName,
        type: b.performerType,
        status: b.status,
      })),
    });
  }

  return { rows };
}
