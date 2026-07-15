import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { makeEvent, makePerformer } from "./helpers/factories";
import { createBooking } from "@/server/domain/bookings/bookingService";
import { createRateParameter } from "@/server/domain/parameters/seriesParameterService";

// FR-006, SC-003
describe("Musician rate booking default", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("defaults to $0 when no Musician rate is set for the series", async () => {
    const evt = await makeEvent({ seriesKey: "tnc", eventDate: "2026-06-18" });
    const musician = await makePerformer("No Rate Musician");
    const booking = await createBooking(db, evt.id, {
      performerId: musician.id,
      performerType: "musician",
    });
    expect(booking.payCents).toBe(0);
  });

  it("defaults both Musician and Lead Musician bookings to the series' Musician rate, overridable", async () => {
    await createRateParameter(db, {
      seriesKey: "tnc",
      kind: "musician",
      amount: 75,
      effectiveDate: "2026-01-01",
    });
    const evt = await makeEvent({ seriesKey: "tnc", eventDate: "2026-06-18" });

    const musician = await makePerformer("Rate Musician");
    const musicianBooking = await createBooking(db, evt.id, {
      performerId: musician.id,
      performerType: "musician",
    });
    expect(musicianBooking.payCents).toBe(7500);
    expect(musicianBooking.isOverridden).toBe(false);

    const lead = await makePerformer("Rate Lead Musician");
    const leadBooking = await createBooking(db, evt.id, {
      performerId: lead.id,
      performerType: "lead_musician",
    });
    expect(leadBooking.payCents).toBe(7500);

    const overridden = await makePerformer("Overridden Musician");
    const overriddenBooking = await createBooking(db, evt.id, {
      performerId: overridden.id,
      performerType: "musician",
      pay: 100,
    });
    expect(overriddenBooking.payCents).toBe(10000);
    expect(overriddenBooking.isOverridden).toBe(true);
  });
});
