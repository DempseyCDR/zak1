import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { makeEvent } from "./helpers/factories";
import { events, venues } from "@/server/db/schema";
import { createVenueRent, resolveEventRentCents } from "@/server/domain/parameters/rentService";

async function eventRow(id: string) {
  return (await db.query.events.findFirst({ where: eq(events.id, id) }))!;
}

// FR-002, FR-004, SC-003 — no-venue direct rent, and series-at-venue is scoped per venue.
describe("venue rent scoping", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("a no-venue event uses a directly-entered per-event rent, else 0", async () => {
    const evt = await makeEvent({ seriesKey: "tnc", eventDate: "2026-06-01" });
    expect(await resolveEventRentCents(db, await eventRow(evt.id))).toBe(0);
    await db.update(events).set({ rentCents: 4500 }).where(eq(events.id, evt.id));
    expect(await resolveEventRentCents(db, await eventRow(evt.id))).toBe(4500);
  });

  it("a series-at-venue rate at venue A does not affect that series' events at venue B", async () => {
    const [a] = await db.insert(venues).values({ name: "A", address: "a" }).returning();
    const [b] = await db.insert(venues).values({ name: "B", address: "b" }).returning();
    const evtA = await makeEvent({ seriesKey: "tnc", eventDate: "2026-06-01" });
    const evtB = await makeEvent({ seriesKey: "tnc", eventDate: "2026-06-02" });
    await db.update(events).set({ venueId: a!.id }).where(eq(events.id, evtA.id));
    await db.update(events).set({ venueId: b!.id }).where(eq(events.id, evtB.id));
    await createVenueRent(db, {
      venueId: a!.id,
      seriesKey: "tnc",
      amount: 60,
      effectiveDate: "2026-01-01",
    });
    expect(await resolveEventRentCents(db, await eventRow(evtA.id))).toBe(6000);
    expect(await resolveEventRentCents(db, await eventRow(evtB.id))).toBe(0); // venue B has no rent
  });
});
