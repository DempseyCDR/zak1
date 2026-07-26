import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { makeEvent } from "./helpers/factories";
import { events, series } from "@/server/db/schema";
import { createVenue } from "@/server/domain/venues/venueService";
import { priorEventDefaults } from "@/server/domain/events/eventService";

async function seriesId(key: string): Promise<string> {
  const s = await db.query.series.findFirst({ where: eq(series.key, key) });
  if (!s) throw new Error(`series ${key} missing`);
  return s.id;
}

// Feature 020 US4 (FR-018): a new event defaults venue + start time from the LATEST event in the series
// with date < the new event's date.
describe("priorEventDefaults", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("returns the venue + start time of the latest prior event in the series", async () => {
    const venue = await createVenue(db, { name: "German House", address: "1 Main" });
    const older = await makeEvent({ seriesKey: "tnc", eventDate: "2026-05-01" });
    const prior = await makeEvent({ seriesKey: "tnc", eventDate: "2026-06-01" });
    await db
      .update(events)
      .set({ venueId: venue.id, startTime: "19:30" })
      .where(eq(events.id, prior.id));
    // An older event with a different venue must be ignored (prior wins).
    await db.update(events).set({ startTime: "18:00" }).where(eq(events.id, older.id));

    const d = await priorEventDefaults(db, await seriesId("tnc"), "2026-06-18");
    expect(d.venueId).toBe(venue.id);
    expect(d.startTime).toBe("19:30:00"); // PG `time` renders seconds
  });

  it("ignores events on/after the new date", async () => {
    const venue = await createVenue(db, { name: "The Rose Room", address: "2 Elm" });
    const future = await makeEvent({ seriesKey: "tnc", eventDate: "2026-07-01" });
    await db
      .update(events)
      .set({ venueId: venue.id, startTime: "20:00" })
      .where(eq(events.id, future.id));
    const d = await priorEventDefaults(db, await seriesId("tnc"), "2026-06-18");
    expect(d.venueId).toBeNull();
    expect(d.startTime).toBeNull();
  });

  it("returns nulls when the series has no prior event", async () => {
    const d = await priorEventDefaults(db, await seriesId("ecd"), "2026-06-18");
    expect(d).toEqual({ venueId: null, startTime: null });
  });
});
