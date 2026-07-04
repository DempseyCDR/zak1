import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { jsonReq, ctx } from "./helpers/http";
import { makeEvent, makePerformer } from "./helpers/factories";
import { bookings } from "@/server/db/schema";
import { createBand } from "@/server/domain/bands/bandService";
import { createBooking } from "@/server/domain/bookings/bookingService";
import { POST as BOOK_BAND } from "@/app/api/events/[id]/book-band/route";

// FR-003c
describe("book-band skips a member already booked on the event", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("creates bookings only for not-yet-booked members, no duplicate, no error", async () => {
    const lead = await makePerformer("Lead");
    const m1 = await makePerformer("M1");
    const band = await createBand(db, {
      name: "Duo",
      members: [
        { performerId: lead.id, isLead: true },
        { performerId: m1.id, isLead: false },
      ],
    });
    const evt = await makeEvent();
    // m1 is already booked individually on this event.
    await createBooking(db, evt.id, { performerId: m1.id, performerType: "musician", pay: 50 });

    const res = await BOOK_BAND(
      jsonReq("POST", `/api/events/${evt.id}/book-band`, { bandId: band.id }),
      ctx({ id: evt.id }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.createdCount).toBe(1);
    expect(body.skippedCount).toBe(1);

    const m1Rows = await db
      .select()
      .from(bookings)
      .where(and(eq(bookings.eventId, evt.id), eq(bookings.performerId, m1.id)));
    expect(m1Rows).toHaveLength(1); // no duplicate
    expect(m1Rows[0]?.payCents).toBe(5000); // original individual booking untouched (band pay didn't overwrite)
    expect(m1Rows[0]?.bandId).toBeNull();
  });
});
