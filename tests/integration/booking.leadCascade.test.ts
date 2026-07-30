import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { makeEvent, makePerformer } from "./helpers/factories";
import { bookings } from "@/server/db/schema";
import { createBand } from "@/server/domain/bands/bandService";
import { bookBand } from "@/server/domain/bands/bookBand";
import { patchBooking } from "@/server/domain/bookings/bookingService";

// Feature 024 US1 (FR-001/FR-002): a band lead's status change cascades to lockstep siblings; a diverged
// member is left untouched; a non-lead change moves no one.
describe("band lead status cascade", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  async function bookABand() {
    const lead = await makePerformer("Lead Larry");
    const m1 = await makePerformer("Member Mo");
    const m2 = await makePerformer("Member May");
    const band = await createBand(db, {
      name: "The Trio",
      members: [
        { performerId: lead.id, isLead: true },
        { performerId: m1.id, isLead: false },
        { performerId: m2.id, isLead: false },
      ],
    });
    const evt = await makeEvent();
    await bookBand(db, evt.id, band.id);
    const rows = await db
      .select()
      .from(bookings)
      .where(and(eq(bookings.eventId, evt.id), eq(bookings.bandId, band.id)));
    const leadBooking = rows.find((r) => r.performerType === "lead_musician")!;
    const memberBookings = rows.filter((r) => r.performerType === "musician");
    return { evt, band, lead, leadBooking, memberBookings, m1, m2 };
  }

  it("cascades a lockstep band to the lead's new status (status only)", async () => {
    const { leadBooking, memberBookings } = await bookABand();
    // All start `proposed`. Advance the LEAD proposed → requested.
    await patchBooking(db, leadBooking.id, { status: "requested" });

    for (const m of memberBookings) {
      const row = await db.query.bookings.findFirst({ where: eq(bookings.id, m.id) });
      expect(row?.status).toBe("requested");
      // status only — pay/donated/note preserved.
      expect(row?.payCents).toBe(m.payCents);
      expect(row?.isDonated).toBe(m.isDonated);
      expect(row?.note).toBe(m.note);
    }
  });

  it("leaves a diverged (individually declined) member untouched", async () => {
    const { leadBooking, memberBookings } = await bookABand();
    const [diverged, follower] = memberBookings;
    // One member is declined off the group beforehand (a sub arranged).
    await patchBooking(db, diverged!.id, { status: "declined" });

    // Advance the lead proposed → requested.
    await patchBooking(db, leadBooking.id, { status: "requested" });

    const divergedRow = await db.query.bookings.findFirst({ where: eq(bookings.id, diverged!.id) });
    expect(divergedRow?.status).toBe("declined"); // NOT revived, NOT moved

    const followerRow = await db.query.bookings.findFirst({ where: eq(bookings.id, follower!.id) });
    expect(followerRow?.status).toBe("requested"); // still in lockstep → follows
  });

  it("does not cascade when a NON-lead member's status changes", async () => {
    const { leadBooking, memberBookings } = await bookABand();
    const [changed, other] = memberBookings;
    await patchBooking(db, changed!.id, { status: "requested" });

    const leadRow = await db.query.bookings.findFirst({ where: eq(bookings.id, leadBooking.id) });
    expect(leadRow?.status).toBe("proposed"); // lead unmoved
    const otherRow = await db.query.bookings.findFirst({ where: eq(bookings.id, other!.id) });
    expect(otherRow?.status).toBe("proposed"); // sibling unmoved
  });
});
