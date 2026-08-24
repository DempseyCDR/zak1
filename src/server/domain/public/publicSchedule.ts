import { and, asc, desc, eq, gte, lt } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import { events, series, venues } from "@/server/db/schema";
import { groupEventBookingsForDisplay } from "@/server/domain/bands/publicDisplay";
import { centsToDollars } from "@/server/lib/money";
import { mapPublicPerformers, type PublicPerformer } from "./performerDisplay";
import { publicVenueView, type PublicVenue } from "./publicVenues";
import { formatWallClock } from "./wallClock";

export type PublicScheduleItem = {
  eventId: string;
  date: string;
  activity: string;
  seriesKey: string; // feature 048 (P7-R4): stable series key → the card's color accent (never `activity`)
  venueName: string | null;
  venueShortName: string | null; // feature 048 (P7-R4): the card's venue field; null → card falls back to venueName
  label: string | null;
  startTime: string | null; // display-formatted wall-clock (e.g. "7:30 PM"), venue-local
  cancelled: boolean; // feature 018 (B25): still listed, shown with a cancelled marker
  advertisedPrice: number | null; // feature 018 (B27): public display price in dollars; null = not shown
};

export type PublicBandBlock = { name: string; bio: string | null; photoUrl: string | null };
// Feature 052 (P7-R8): PublicVenue now lives in publicVenues.ts (the gate), with nullable address/mapUrl/
// directions so a non-public venue is name-only. Re-exported here for existing consumers.
export type { PublicVenue };
export type PublicEventDetail = {
  eventId: string;
  date: string;
  activity: string;
  seriesKey: string; // feature 049 (P7-R5): stable series key → page color accent + hero (matches the R4 card)
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
export function homeWindowStart(
  day: string,
  lookbackDays: number = HOME_WINDOW_LOOKBACK_DAYS,
): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - lookbackDays);
  return d.toISOString().slice(0, 10);
}

/**
 * Shared public-listing query (feature 037, P6-R4/R5). Both public readers delegate here so the
 * public-safe projection and the optional series filter live once: a lower bound (`from`, inclusive),
 * an upper bound (`before`, exclusive), an optional `seriesKey` filter, and the sort direction.
 * Public-safe — no money/attendance/contacts.
 */
async function listPublicEvents(
  db: Db,
  opts: { from?: string; before?: string; seriesKey?: string; order: "asc" | "desc" },
): Promise<PublicScheduleItem[]> {
  const conds = [
    opts.from !== undefined ? gte(events.eventDate, opts.from) : undefined,
    opts.before !== undefined ? lt(events.eventDate, opts.before) : undefined,
    opts.seriesKey !== undefined ? eq(series.key, opts.seriesKey) : undefined,
  ].filter((c) => c !== undefined);
  const rows = await db
    .select({
      eventId: events.id,
      date: events.eventDate,
      activity: series.name,
      seriesKey: series.key,
      venueName: venues.name,
      venueShortName: venues.shortName,
      label: events.label,
      startTime: events.startTime,
      status: events.status,
      advertisedPriceCents: events.advertisedPriceCents,
    })
    .from(events)
    .innerJoin(series, eq(series.id, events.seriesId))
    .leftJoin(venues, eq(venues.id, events.venueId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(opts.order === "asc" ? asc(events.eventDate) : desc(events.eventDate));
  return rows.map(({ status, advertisedPriceCents, ...r }) => ({
    ...r,
    startTime: formatWallClock(r.startTime),
    cancelled: status === "cancelled",
    advertisedPrice: advertisedPriceCents === null ? null : centsToDollars(advertisedPriceCents),
  }));
}

/**
 * Public home schedule (FR-001/FR-010; window widened by 036, P6-R3; series filter by 037, P6-R5):
 * events on/after `from` — which defaults to **two days ago** (`homeWindowStart(today())`), so
 * `/whats-on` shows the recent past plus everything upcoming — ascending, optionally filtered to one
 * series. `from` stays injectable for deterministic tests.
 */
export async function getPublicSchedule(
  db: Db,
  from: string = homeWindowStart(today()),
  seriesKey?: string,
): Promise<PublicScheduleItem[]> {
  return listPublicEvents(db, { from, seriesKey, order: "asc" });
}

/**
 * Public dance history (feature 037, P6-R4): events dated **before** `before` (defaults to today),
 * most-recent-first (descending), optionally filtered to one series (P6-R5). `before` is injectable for
 * deterministic tests. The `[before-2, before)` window overlaps `/whats-on`'s home window by design.
 */
export async function getPublicHistory(
  db: Db,
  before: string = today(),
  seriesKey?: string,
): Promise<PublicScheduleItem[]> {
  return listPublicEvents(db, { before, seriesKey, order: "desc" });
}

/** All club series as `{ key, name }`, ordered by name — the series-filter options (feature 037, FR-009). */
export async function listSeries(db: Db): Promise<{ key: string; name: string }[]> {
  return db.select({ key: series.key, name: series.name }).from(series).orderBy(asc(series.name));
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
      seriesKey: series.key,
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

  // Feature 052 (P7-R8): gate the venue — publicVenueView shows address/map/directions only for a public
  // venue with an address; otherwise name-only. A private-home address is never exposed here.
  let venue: PublicVenue | null = null;
  if (row.venueId) {
    const v = await db.query.venues.findFirst({ where: eq(venues.id, row.venueId) });
    if (v) {
      venue = publicVenueView(v);
    }
  }

  const grouped = await groupEventBookingsForDisplay(db, eventId);
  const performers = await mapPublicPerformers(db, grouped.adHoc);

  return {
    eventId: row.eventId,
    date: row.date,
    activity: row.activity,
    seriesKey: row.seriesKey,
    venue,
    label: row.label,
    startTime: formatWallClock(row.startTime),
    description: row.description,
    cancelled: row.status === "cancelled",
    advertisedPrice:
      row.advertisedPriceCents === null ? null : centsToDollars(row.advertisedPriceCents),
    bandBlocks: grouped.bandBlocks.map((b) => ({
      name: b.name,
      bio: b.bio,
      photoUrl: b.photoUrl,
      members: b.members,
    })),
    performers,
  };
}
