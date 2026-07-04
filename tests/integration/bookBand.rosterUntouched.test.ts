import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { makeEvent, makePerformer } from "./helpers/factories";
import { bandMembers, bookings } from "@/server/db/schema";
import { createBand } from "@/server/domain/bands/bandService";
import { bookBand } from "@/server/domain/bands/bookBand";
import { createBooking, deleteBooking } from "@/server/domain/bookings/bookingService";

// FR-005, US2 scenario 2 — per-event booking edits leave the reusable roster untouched.
describe("editing an event's bookings does not alter the band roster", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("remove one created booking + add a substitute for the event; roster is unchanged", async () => {
    const lead = await makePerformer("Lead");
    const m1 = await makePerformer("M1");
    const sub = await makePerformer("Substitute");
    const band = await createBand(db, {
      name: "Band",
      members: [
        { performerId: lead.id, isLead: true },
        { performerId: m1.id, isLead: false },
      ],
    });
    const evt = await makeEvent();
    await bookBand(db, evt.id, band.id);

    // m1 can't make it: remove that booking, add the substitute individually.
    const m1Booking = (await db.select().from(bookings).where(eq(bookings.eventId, evt.id))).find(
      (b) => b.performerId === m1.id,
    )!;
    await deleteBooking(db, m1Booking.id);
    await createBooking(db, evt.id, { performerId: sub.id, performerType: "musician", pay: 60 });

    // The band's reusable roster is unchanged.
    const roster = await db.select().from(bandMembers).where(eq(bandMembers.bandId, band.id));
    expect(roster.map((r) => r.performerId).sort()).toEqual([lead.id, m1.id].sort());
  });
});
