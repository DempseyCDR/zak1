import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { makeEvent, makePerformer } from "./helpers/factories";
import { bookings } from "@/server/db/schema";
import { createBooking } from "@/server/domain/bookings/bookingService";
import { getPublicEventDetail } from "@/server/domain/public/publicSchedule";

// Feature 018 (FR-022): the public event detail shows ONLY confirmed bookings, and never performer pay.
describe("public detail shows only confirmed bookings", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("hides a proposed booking and reveals it once confirmed; never leaks pay", async () => {
    const evt = await makeEvent({ seriesKey: "tnc", eventDate: "2026-06-18" });
    const caller = await makePerformer("Cal Caller");
    const booking = await createBooking(db, evt.id, {
      performerId: caller.id,
      performerType: "caller",
      pay: 150,
    });

    // Proposed → not shown publicly.
    let detail = await getPublicEventDetail(db, evt.id);
    expect(JSON.stringify(detail)).not.toContain("Cal Caller");

    // Confirm → now shown.
    await db.update(bookings).set({ status: "confirmed" }).where(eq(bookings.id, booking.id));
    detail = await getPublicEventDetail(db, evt.id);
    const serialized = JSON.stringify(detail);
    expect(serialized).toContain("Cal Caller");
    // Public-safety: no pay amount ever.
    expect(serialized).not.toMatch(/payCents|"pay"|checkNumber/i);
    expect(serialized).not.toContain("15000");
  });
});
