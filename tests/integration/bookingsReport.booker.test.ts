import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { makeEvent, makePerformer } from "./helpers/factories";
import { events, venues } from "@/server/db/schema";
import { createBooking } from "@/server/domain/bookings/bookingService";
import { createVenue } from "@/server/domain/venues/venueService";
import { assembleBookingsReport } from "@/server/domain/bookings/reportService";

// Feature 020 US1 (FR-001/002/004/006): sort direction, venue short name (+ fallback), hasSoundTech, and
// the existing performer filter still working.
describe("bookings report — booker view", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("sorts by date desc (default, feature 029) and asc", async () => {
    await makeEvent({ seriesKey: "tnc", eventDate: "2026-06-04" });
    await makeEvent({ seriesKey: "tnc", eventDate: "2026-06-18" });

    // Feature 029 (P5-R2): the no-`sort` default is now descending (newest-relevant-first).
    const def = await assembleBookingsReport(db, {});
    expect(def.rows.map((r) => r.date)).toEqual(["2026-06-18", "2026-06-04"]);
    const desc = await assembleBookingsReport(db, { sort: "desc" });
    expect(desc.rows.map((r) => r.date)).toEqual(["2026-06-18", "2026-06-04"]);
    // Explicit ascending still works.
    const asc = await assembleBookingsReport(db, { sort: "asc" });
    expect(asc.rows.map((r) => r.date)).toEqual(["2026-06-04", "2026-06-18"]);
  });

  it("shows the venue short name, falling back to derived initials when null", async () => {
    const withShort = await createVenue(db, { name: "German House", address: "1 Main" });
    const noShort = await createVenue(db, { name: "The Rose Room", address: "2 Elm" });
    await db.update(venues).set({ shortName: null }).where(eq(venues.id, noShort.id)); // force fallback

    const e1 = await makeEvent({ seriesKey: "tnc", eventDate: "2026-06-04" });
    const e2 = await makeEvent({ seriesKey: "tnc", eventDate: "2026-06-18" });
    await db.update(events).set({ venueId: withShort.id }).where(eq(events.id, e1.id));
    await db.update(events).set({ venueId: noShort.id }).where(eq(events.id, e2.id));

    const { rows } = await assembleBookingsReport(db, {});
    const byId = new Map(rows.map((r) => [r.eventId, r]));
    expect(byId.get(e1.id)?.venueShortName).toBe("GH"); // stored
    expect(byId.get(e2.id)?.venueShortName).toBe("TRR"); // derived fallback
  });

  it("reports hasSoundTech per the event's series (false for community_dance)", async () => {
    const tnc = await makeEvent({ seriesKey: "tnc", eventDate: "2026-06-04" });
    const cd = await makeEvent({ seriesKey: "community_dance", eventDate: "2026-06-05" });
    const { rows } = await assembleBookingsReport(db, {});
    const byId = new Map(rows.map((r) => [r.eventId, r]));
    expect(byId.get(tnc.id)?.hasSoundTech).toBe(true);
    expect(byId.get(cd.id)?.hasSoundTech).toBe(false);
  });

  it("still filters by performer after the sort/venue changes (FR-006 regression)", async () => {
    const p = await makePerformer("Bob Fabinski");
    const withP = await makeEvent({ seriesKey: "tnc", eventDate: "2026-06-04" });
    const withoutP = await makeEvent({ seriesKey: "tnc", eventDate: "2026-06-18" });
    await createBooking(db, withP.id, { performerId: p.id, performerType: "musician", pay: 100 });

    const { rows } = await assembleBookingsReport(db, { musician: p.id, sort: "desc" });
    expect(rows.map((r) => r.eventId)).toEqual([withP.id]);
    expect(rows.some((r) => r.eventId === withoutP.id)).toBe(false);
    // The booking line carries its id so the report UI can open the booking modal (US2).
    expect(rows[0]?.bookings[0]?.bookingId).toBeDefined();
  });
});
