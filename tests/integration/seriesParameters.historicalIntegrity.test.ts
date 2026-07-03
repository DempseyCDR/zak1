import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { makeEvent, makeDoorRecord, makePerformer } from "./helpers/factories";
import { bookings } from "@/server/db/schema";
import { updateDoorRecord } from "@/server/domain/door/doorRecordService";
import { createBooking } from "@/server/domain/bookings/bookingService";
import { createRateParameter } from "@/server/domain/parameters/seriesParameterService";
import { assembleOrganizerReport } from "@/server/domain/organizer/reportService";

const year = 2026;

// FR-010 — superseding a parameter must not rewrite history already recorded.
describe("superseding a parameter does not rewrite history", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("a booking's stored payCents is unaffected by a later-effective-dated rate change", async () => {
    await createRateParameter(db, { seriesKey: "tnc", kind: "caller", amount: 150, effectiveDate: "2026-01-01" });
    const evt = await makeEvent({ seriesKey: "tnc", eventDate: "2026-03-01" });
    const performer = await makePerformer("Historical Caller");
    const booking = await createBooking(db, evt.id, { performerId: performer.id, performerType: "caller" });
    expect(booking.payCents).toBe(15000);

    // Supersede the rate with a new entry effective *after* the booking's event date.
    await createRateParameter(db, { seriesKey: "tnc", kind: "caller", amount: 300, effectiveDate: "2026-06-01" });

    const stored = await db.query.bookings.findFirst({ where: eq(bookings.id, booking.id) });
    expect(stored?.payCents).toBe(15000); // unchanged, not re-resolved to the new rate
  });

  it("an Organizer Report for a past event keeps resolving the rent in effect on that event's date", async () => {
    await createRateParameter(db, { seriesKey: "tnc", kind: "caller", amount: 150, effectiveDate: "2026-01-01" });
    const evt = await makeEvent({ seriesKey: "tnc", eventDate: "2026-03-01" });
    const drId = await makeDoorRecord(evt.id);
    await updateDoorRecord(db, drId, { grossCash: 300, seedFloat: 0 });

    // Seed a rent parameter effective before the event, then supersede it with one effective
    // well after the event's date.
    const { createExpenseParameter } = await import("@/server/domain/parameters/seriesParameterService");
    await createExpenseParameter(db, { seriesKey: "tnc", kind: "rent", amount: 80, effectiveDate: "2026-01-01" });
    await createExpenseParameter(db, { seriesKey: "tnc", kind: "rent", amount: 999, effectiveDate: "2026-06-01" });

    const report = await assembleOrganizerReport(db, "tnc", year);
    const row = report.perDanceRows[0] as Record<string, unknown>;
    expect(row.rent).toBe(80); // still the rate in effect on 2026-03-01, not the later $999 override
  });
});
