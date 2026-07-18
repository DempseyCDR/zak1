import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { makeEvent, makePerformer } from "./helpers/factories";
import { bookings } from "@/server/db/schema";
import { createBooking, patchBooking } from "@/server/domain/bookings/bookingService";

// Feature 018 (B23): per-booking status lifecycle + re-point.
describe("booking status lifecycle", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  async function makeBooking() {
    const evt = await makeEvent({ seriesKey: "tnc" });
    const caller = await makePerformer("Cal Caller");
    const booking = await createBooking(db, evt.id, {
      performerId: caller.id,
      performerType: "caller",
      pay: 150,
    });
    return { evt, booking };
  }

  it("defaults a new booking to proposed", async () => {
    const { booking } = await makeBooking();
    expect(booking.status).toBe("proposed");
  });

  it("advances proposed → requested → confirmed", async () => {
    const { booking } = await makeBooking();
    const req = await patchBooking(db, booking.id, { status: "requested" });
    expect(req.status).toBe("requested");
    const conf = await patchBooking(db, booking.id, { status: "confirmed" });
    expect(conf.status).toBe("confirmed");
  });

  it("rejects a skip (proposed → confirmed)", async () => {
    const { booking } = await makeBooking();
    await expect(patchBooking(db, booking.id, { status: "confirmed" })).rejects.toThrow();
  });

  it("marks a booking declined", async () => {
    const { booking } = await makeBooking();
    const declined = await patchBooking(db, booking.id, { status: "declined" });
    expect(declined.status).toBe("declined");
  });

  it("re-points to a new performer: resets to proposed and clears a stale check number", async () => {
    const { booking } = await makeBooking();
    // Simulate a booking that had been confirmed and paid (check number recorded).
    await db
      .update(bookings)
      .set({ status: "confirmed", checkNumber: "1234" })
      .where(eq(bookings.id, booking.id));

    const other = await makePerformer("Ada Alternate");
    const repointed = await patchBooking(db, booking.id, { performerId: other.id });

    expect(repointed.performerId).toBe(other.id);
    expect(repointed.status).toBe("proposed");
    expect(repointed.checkNumber).toBeNull(); // never carry the previous performer's check
  });
});
