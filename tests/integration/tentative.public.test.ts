import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { makeEvent, makePerformer } from "./helpers/factories";
import { bookings } from "@/server/db/schema";
import { createBooking, patchBooking } from "@/server/domain/bookings/bookingService";
import { getPublicEventDetail } from "@/server/domain/public/publicSchedule";

// Feature 020 US3 (FR-015): a 'tentative' booking is internal only — the public path is confirmed-only, so
// it is excluded with no code change. FR-016 (analyze U1): substituting a performer resets to proposed,
// from any prior state.
describe("tentative status — internal only, and substitute reset", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("keeps a tentative booking off the public event detail", async () => {
    const evt = await makeEvent({ seriesKey: "tnc", eventDate: "2026-06-18" });
    const caller = await makePerformer("Tent Caller");
    const booking = await createBooking(db, evt.id, {
      performerId: caller.id,
      performerType: "caller",
      pay: 150,
    });
    await patchBooking(db, booking.id, { status: "requested" }, "test");
    await patchBooking(db, booking.id, { status: "tentative" }, "test");

    const detail = await getPublicEventDetail(db, evt.id);
    expect(JSON.stringify(detail)).not.toContain("Tent Caller");

    // Confirm → now public (proves the exclusion was the status, not the performer).
    await patchBooking(db, booking.id, { status: "confirmed" }, "test");
    expect(JSON.stringify(await getPublicEventDetail(db, evt.id))).toContain("Tent Caller");
  });

  it("resets a tentative booking to proposed on substitute (FR-016)", async () => {
    const evt = await makeEvent({ seriesKey: "tnc" });
    const booked = await makePerformer("Booked Bea");
    const sub = await makePerformer("Sub Sam");
    const booking = await createBooking(db, evt.id, {
      performerId: booked.id,
      performerType: "musician",
      pay: 125,
    });
    // Drive it to tentative.
    await patchBooking(db, booking.id, { status: "requested" }, "test");
    await patchBooking(db, booking.id, { status: "tentative" }, "test");

    // Substitute the performer → re-point.
    await patchBooking(db, booking.id, { performerId: sub.id }, "test");

    const row = await db.query.bookings.findFirst({ where: eq(bookings.id, booking.id) });
    expect(row?.performerId).toBe(sub.id);
    expect(row?.status).toBe("proposed");
  });
});
