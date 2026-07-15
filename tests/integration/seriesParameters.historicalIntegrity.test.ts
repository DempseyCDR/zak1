import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { makeEvent, makeDoorRecord, makePerformer } from "./helpers/factories";
import { bookings, events, venues } from "@/server/db/schema";
import { updateDoorRecord } from "@/server/domain/door/doorRecordService";
import { createBooking } from "@/server/domain/bookings/bookingService";
import { createRateParameter } from "@/server/domain/parameters/seriesParameterService";
import { createVenueRent } from "@/server/domain/parameters/rentService";
import { assembleOrganizerReport } from "@/server/domain/organizer/reportService";

const year = 2026;

// FR-012 — superseding a parameter must not rewrite history already recorded.
describe("superseding a parameter does not rewrite history", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("a booking's stored payCents is unaffected by a later-effective-dated rate change", async () => {
    await createRateParameter(db, {
      seriesKey: "tnc",
      kind: "caller",
      amount: 150,
      effectiveDate: "2026-01-01",
    });
    const evt = await makeEvent({ seriesKey: "tnc", eventDate: "2026-03-01" });
    const performer = await makePerformer("Historical Caller");
    const booking = await createBooking(db, evt.id, {
      performerId: performer.id,
      performerType: "caller",
    });
    expect(booking.payCents).toBe(15000);

    // Supersede the rate with a new entry effective *after* the booking's event date.
    await createRateParameter(db, {
      seriesKey: "tnc",
      kind: "caller",
      amount: 300,
      effectiveDate: "2026-06-01",
    });

    const stored = await db.query.bookings.findFirst({ where: eq(bookings.id, booking.id) });
    expect(stored?.payCents).toBe(15000); // unchanged, not re-resolved to the new rate
  });

  it("an Organizer Report for a past event keeps resolving the venue rent in effect on that event's date", async () => {
    const evt = await makeEvent({ seriesKey: "tnc", eventDate: "2026-03-01" });
    const [venue] = await db
      .insert(venues)
      .values({ name: "Grange", address: "1 Main St" })
      .returning();
    await db.update(events).set({ venueId: venue!.id }).where(eq(events.id, evt.id));
    const drId = await makeDoorRecord(evt.id);
    await updateDoorRecord(db, drId, { grossCash: 300, seedFloat: 0 });

    // Venue default rent effective before the event, superseded well after the event's date.
    await createVenueRent(db, { venueId: venue!.id, amount: 80, effectiveDate: "2026-01-01" });
    await createVenueRent(db, { venueId: venue!.id, amount: 999, effectiveDate: "2026-06-01" });

    const report = await assembleOrganizerReport(db, "tnc", year);
    const row = report.perDanceRows[0] as Record<string, unknown>;
    expect(row.rent).toBe(80); // rent in effect on 2026-03-01, not the later $999
  });
});
