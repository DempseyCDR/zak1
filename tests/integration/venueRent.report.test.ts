import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { makeEvent, makeDoorRecord } from "./helpers/factories";
import { events, venues } from "@/server/db/schema";
import { updateDoorRecord } from "@/server/domain/door/doorRecordService";
import { createVenueRent } from "@/server/domain/parameters/rentService";
import { assembleOrganizerReport } from "@/server/domain/organizer/reportService";

// FR-006, FR-007, SC-004, SC-006 — the report honors an event's frozen rent_cents; a later venue
// rent does not change an event that carries a per-event rent (the migration-freeze property).
describe("organizer report — event rent freeze", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("subtracts an event's rent_cents in Dance Net", async () => {
    const evt = await makeEvent({ seriesKey: "tnc", eventDate: "2026-06-18" });
    await db.update(events).set({ rentCents: 8000 }).where(eq(events.id, evt.id));
    const drId = await makeDoorRecord(evt.id);
    await updateDoorRecord(db, drId, { grossCash: 300, seedFloat: 0 });

    const report = await assembleOrganizerReport(db, "tnc", 2026);
    const row = report.perDanceRows[0] as Record<string, unknown>;
    expect(row.rent).toBe(80);
    expect(row.danceNet).toBe(220); // 300 admission − 80 rent
  });

  it("a later venue rent does not change an event that has a per-event rent (freeze holds)", async () => {
    const evt = await makeEvent({ seriesKey: "tnc", eventDate: "2026-06-18" });
    const [venue] = await db.insert(venues).values({ name: "Hall", address: "1 St" }).returning();
    await db.update(events).set({ venueId: venue!.id, rentCents: 8000 }).where(eq(events.id, evt.id));
    await createVenueRent(db, { venueId: venue!.id, amount: 50000, effectiveDate: "2026-01-01" });

    const report = await assembleOrganizerReport(db, "tnc", 2026);
    const row = report.perDanceRows[0] as Record<string, unknown>;
    expect(row.rent).toBe(80); // per-event override wins; the $500 venue rent is ignored
  });
});
