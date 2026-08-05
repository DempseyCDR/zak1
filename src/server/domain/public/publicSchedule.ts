import { asc, eq, gte } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import { events, series, venues } from "@/server/db/schema";
import { groupEventBookingsForDisplay } from "@/server/domain/bands/publicDisplay";
import { centsToDollars } from "@/server/lib/money";
import { mapPublicPerformers, type PublicPerformer } from "./performerDisplay";
import { venueMapUrl } from "./venueMap";
import { formatWallClock } from "./wallClock";

export type PublicScheduleItem = {
  eventId: string;
  date: string;
  activity: string;
  venueName: string | null;
  label: string | null;
  startTime: string | null; // display-formatted wall-clock (e.g. "7:30 PM"), venue-local
  cancelled: boolean; // feature 018 (B25): still listed, shown with a cancelled marker
  advertisedPrice: number | null; // feature 018 (B27): public display price in dollars; null = not shown
};

export type PublicBandBlock = { name: string; bio: string | null; photoUrl: string | null };
export type PublicVenue = { name: string; address: string; mapUrl: string };
export type PublicEventDetail = {
  eventId: string;
  date: string;
  activity: string;
  venue: PublicVenue | null;
  label: string | null;
  startTime: string | null; // display-formatted wall-clock, venue-local
  description: string | null;
  cancelled: boolean; // feature 018 (B25)
  advertisedPrice: number | null; // feature 018 (B27), dollars; display-only
  bandBlocks: PublicBandBlock[];
  performers: PublicPerformer[];
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** The /whats-on home page's fixed lookback: it lists dances from this many calendar days ago onward (036, P6-R3). */
export const HOME_WINDOW_LOOKBACK_DAYS = 2;

/**
 * The home window's inclusive lower bound: `lookbackDays` calendar days before `day` (both `YYYY-MM-DD`).
 * Pure, and UTC-based to match `today()`, so month/year rollover is correct (e.g. 2026-03-01 → 2026-02-27).
 * Feature 036 (P6-R3) — the single, testable expression of the two-day lookback.
 */
export function homeWindowStart(day: string, lookbackDays: number = HOME_WINDOW_LOOKBACK_DAYS): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - lookbackDays);
  return d.toISOString().slice(0, 10);
}

/**
 * Public home schedule (FR-001/FR-010; window widened by 036, P6-R3): events on/after `from` — which
 * defaults to **two days ago** (`homeWindowStart(today())`), so `/whats-on` shows the recent past plus
 * everything upcoming — ascending, with activity (series name) + venue name. `from` stays injectable for
 * deterministic tests. Public-safe — no money/attendance/contacts. Free events are included like any other.
 */
export async function getPublicSchedule(
  db: Db,
  from: string = homeWindowStart(today()),
): Promise<PublicScheduleItem[]> {
  const rows = await db
    .select({
      eventId: events.id,
      date: events.eventDate,
      activity: series.name,
      venueName: venues.name,
      label: events.label,
      startTime: events.startTime,
      status: events.status,
      advertisedPriceCents: events.advertisedPriceCents,
    })
    .from(events)
    .innerJoin(series, eq(series.id, events.seriesId))
    .leftJoin(venues, eq(venues.id, events.venueId))
    .where(gte(events.eventDate, from))
    .orderBy(asc(events.eventDate));
  return rows.map(({ status, advertisedPriceCents, ...r }) => ({
    ...r,
    startTime: formatWallClock(r.startTime),
    cancelled: status === "cancelled",
    advertisedPrice: advertisedPriceCents === null ? null : centsToDollars(advertisedPriceCents),
  }));
}

/** Public event detail (FR-002/FR-003): venue + map + public performer/band display. Null if unknown. */
export async function getPublicEventDetail(
  db: Db,
  eventId: string,
): Promise<PublicEventDetail | null> {
  const [row] = await db
    .select({
      eventId: events.id,
      date: events.eventDate,
      activity: series.name,
      venueId: events.venueId,
      label: events.label,
      startTime: events.startTime,
      description: events.description,
      status: events.status,
      advertisedPriceCents: events.advertisedPriceCents,
    })
    .from(events)
    .innerJoin(series, eq(series.id, events.seriesId))
    .where(eq(events.id, eventId))
    .limit(1);
  if (!row) return null;

  let venue: PublicVenue | null = null;
  if (row.venueId) {
    const v = await db.query.venues.findFirst({ where: eq(venues.id, row.venueId) });
    if (v) {
      venue = { name: v.name, address: v.address, mapUrl: venueMapUrl(v) };
    }
  }

  const grouped = await groupEventBookingsForDisplay(db, eventId);
  const performers = await mapPublicPerformers(db, grouped.adHoc);

  return {
    eventId: row.eventId,
    date: row.date,
    activity: row.activity,
    venue,
    label: row.label,
    startTime: formatWallClock(row.startTime),
    description: row.description,
    cancelled: row.status === "cancelled",
    advertisedPrice:
      row.advertisedPriceCents === null ? null : centsToDollars(row.advertisedPriceCents),
    bandBlocks: grouped.bandBlocks.map((b) => ({ name: b.name, bio: b.bio, photoUrl: b.photoUrl })),
    performers,
  };
}
