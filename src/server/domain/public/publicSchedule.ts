import { asc, eq, gte } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import { events, series, venues } from "@/server/db/schema";
import { groupEventBookingsForDisplay } from "@/server/domain/bands/publicDisplay";
import { mapPublicPerformers, type PublicPerformer } from "./performerDisplay";
import { venueMapUrl } from "./venueMap";

export type PublicScheduleItem = {
  eventId: string;
  date: string;
  activity: string;
  venueName: string | null;
};

export type PublicBandBlock = { name: string; bio: string | null; photoUrl: string | null };
export type PublicVenue = { name: string; address: string; mapUrl: string };
export type PublicEventDetail = {
  eventId: string;
  date: string;
  activity: string;
  venue: PublicVenue | null;
  bandBlocks: PublicBandBlock[];
  performers: PublicPerformer[];
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Upcoming public schedule (FR-001/FR-010): events on/after `from` (defaults to today; injectable
 * for deterministic tests), ascending, with activity (series name) + venue name. Public-safe — no
 * money/attendance/contacts. Free (chargesAdmission = false) events are included like any other.
 */
export async function getPublicSchedule(db: Db, from: string = today()): Promise<PublicScheduleItem[]> {
  const rows = await db
    .select({
      eventId: events.id,
      date: events.eventDate,
      activity: series.name,
      venueName: venues.name,
    })
    .from(events)
    .innerJoin(series, eq(series.id, events.seriesId))
    .leftJoin(venues, eq(venues.id, events.venueId))
    .where(gte(events.eventDate, from))
    .orderBy(asc(events.eventDate));
  return rows;
}

/** Public event detail (FR-002/FR-003): venue + map + public performer/band display. Null if unknown. */
export async function getPublicEventDetail(db: Db, eventId: string): Promise<PublicEventDetail | null> {
  const [row] = await db
    .select({
      eventId: events.id,
      date: events.eventDate,
      activity: series.name,
      venueId: events.venueId,
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
    bandBlocks: grouped.bandBlocks.map((b) => ({ name: b.name, bio: b.bio, photoUrl: b.photoUrl })),
    performers,
  };
}
