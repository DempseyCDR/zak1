import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { jsonReqAs, ctx } from "./helpers/http";
import { makeActor, makeEvent, makePerformer } from "./helpers/factories";
import { bookings, series } from "@/server/db/schema";
import { createBooking } from "@/server/domain/bookings/bookingService";
import { POST as ADD } from "@/app/api/events/[id]/settlement-performer/route";

// Feature 030 (FR-011): the FS adds a last-minute performer at settlement — creates a booking via
// performer_payment.write (NOT booking.write), scoped to the event's series, deduping an already-booked
// performer.
async function seriesId(key: string): Promise<string> {
  const row = await db.query.series.findFirst({ where: eq(series.key, key) });
  if (!row) throw new Error(`series ${key} not seeded`);
  return row.id;
}

describe("add-settlement-performer (030 US6)", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  async function fsFor(key: string) {
    const { token } = await makeActor({
      email: `fs-${key}@cdrochester.org`,
      grants: [{ role: "financial_secretary", seriesId: await seriesId(key) }],
    });
    return token;
  }

  const add = (token: string, eventId: string, body: unknown) =>
    ADD(
      jsonReqAs(token, "POST", `/api/events/${eventId}/settlement-performer`, body),
      ctx({ id: eventId }),
    );

  it("creates a booking for an unbooked performer with payment-write, not booking-write", async () => {
    const evt = await makeEvent({ seriesKey: "tnc" });
    const p = await makePerformer("Walkin Wendy");
    const res = await add(await fsFor("tnc"), evt.id, {
      performerId: p.id,
      performerType: "musician",
    });
    expect(res.status).toBe(201);

    const rows = await db.query.bookings.findMany({
      where: and(eq(bookings.eventId, evt.id), eq(bookings.performerId, p.id)),
    });
    expect(rows).toHaveLength(1); // a booking now exists for the walk-in
    expect(rows[0]?.performerType).toBe("musician");
  });

  it("dedupes — a performer already booked returns the existing booking, no duplicate", async () => {
    const evt = await makeEvent({ seriesKey: "tnc" });
    const p = await makePerformer("Booked Bo");
    const existing = await createBooking(db, evt.id, {
      performerId: p.id,
      performerType: "musician",
      pay: 125,
    });
    const res = await add(await fsFor("tnc"), evt.id, {
      performerId: p.id,
      performerType: "musician",
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe(existing.id); // same booking, not a new one

    const rows = await db.query.bookings.findMany({
      where: and(eq(bookings.eventId, evt.id), eq(bookings.performerId, p.id)),
    });
    expect(rows).toHaveLength(1);
  });

  it("is refused for an FS scoped to a different series", async () => {
    const evt = await makeEvent({ seriesKey: "tnc" });
    const p = await makePerformer("Walkin Wendy");
    const res = await add(await fsFor("ecd"), evt.id, {
      performerId: p.id,
      performerType: "musician",
    });
    expect(res.status).toBe(403);
  });
});
