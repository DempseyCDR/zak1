import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { makeEvent } from "./helpers/factories";
import { events } from "@/server/db/schema";
import { createVenue, setEventRent } from "@/server/domain/venues/venueService";
import {
  createVenueRent,
  resolveRentForVenue,
  resolveEventRentCents,
} from "@/server/domain/parameters/rentService";

// Feature 020 US4 (FR-019): the modal shows the resolved default for a chosen venue, and stores dynamically
// (Option A). Server-side we verify: resolve-for-venue works with no per-event override; a null override
// keeps the event tracking the venue default; an explicit override wins; changing venue changes the default.
describe("event rent — resolve-for-venue and Option A storage", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("resolves the venue default for a hypothetical (series, venue, date)", async () => {
    const gh = await createVenue(db, { name: "German House", address: "1 Main" });
    const rr = await createVenue(db, { name: "The Rose Room", address: "2 Elm" });
    await createVenueRent(db, { venueId: gh.id, amount: 200, effectiveDate: "2026-01-01" });
    await createVenueRent(db, { venueId: rr.id, amount: 350, effectiveDate: "2026-01-01" });
    const evt = await makeEvent({ seriesKey: "tnc", eventDate: "2026-06-18" });

    expect(await resolveRentForVenue(db, evt.seriesId, gh.id, "2026-06-18")).toBe(20000);
    // Changing the venue changes the resolved default (drives the modal re-default).
    expect(await resolveRentForVenue(db, evt.seriesId, rr.id, "2026-06-18")).toBe(35000);
    // No venue → 0.
    expect(await resolveRentForVenue(db, evt.seriesId, null, "2026-06-18")).toBe(0);
  });

  it("null override tracks the venue default; an explicit override wins (Option A)", async () => {
    const gh = await createVenue(db, { name: "German House", address: "1 Main" });
    await createVenueRent(db, { venueId: gh.id, amount: 200, effectiveDate: "2026-01-01" });
    const evt = await makeEvent({ seriesKey: "tnc", eventDate: "2026-06-18" });
    await db.update(events).set({ venueId: gh.id }).where(eq(events.id, evt.id));

    // Leave rent at the default (store null) → resolves to the venue default.
    await setEventRent(db, evt.id, null);
    let row = await db.query.events.findFirst({ where: eq(events.id, evt.id) });
    expect(row?.rentCents).toBeNull();
    expect(
      await resolveEventRentCents(db, {
        rentCents: row!.rentCents,
        venueId: gh.id,
        seriesId: evt.seriesId,
        eventDate: "2026-06-18",
      }),
    ).toBe(20000);

    // Type an override → stored and wins.
    await setEventRent(db, evt.id, 15000);
    row = await db.query.events.findFirst({ where: eq(events.id, evt.id) });
    expect(row?.rentCents).toBe(15000);
  });
});
