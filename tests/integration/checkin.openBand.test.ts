import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { jsonReq, ctx } from "./helpers/http";
import { makeEvent, makePerformer } from "./helpers/factories";
import { createContact } from "@/server/domain/contacts/contactService";
import { createBooking } from "@/server/domain/bookings/bookingService";
import { attendance, doorRecords, events } from "@/server/db/schema";
import { POST as ATTEND } from "@/app/api/events/[id]/attendance/route";

// Feature 017 (B36): open-band musician check-in at a community dance — counts as attending and adds a
// comp on the door record (open_band_count), applied per event on redemption (no cross-event counter).
describe("POST /api/events/:id/attendance (open-band musician)", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("flags the row, counts as attending, and comps on the door record (community_dance)", async () => {
    const evt = await makeEvent({ seriesKey: "community_dance" });
    const musician = await createContact(db, { firstName: "Ollie", lastName: "Openband" });

    const res = await ATTEND(
      jsonReq("POST", `/api/events/${evt.id}/attendance`, {
        contactId: musician.id,
        isOpenBand: true,
      }),
      ctx({ id: evt.id }),
    );
    expect(res.status).toBe(201);
    const att = await res.json();

    const row = await db.query.attendance.findFirst({ where: eq(attendance.id, att.id) });
    expect(row?.isOpenBand).toBe(true);

    const ev = await db.query.events.findFirst({ where: eq(events.id, evt.id) });
    expect(ev?.attendanceCount).toBe(1); // counts as attending

    const dr = await db.query.doorRecords.findFirst({ where: eq(doorRecords.eventId, evt.id) });
    expect(dr?.openBandCount).toBe(1); // comped
    expect(dr?.compCount).toBe(0); // separate from the manual comp count
  });

  it("accepts the flag on the new-contact path", async () => {
    const evt = await makeEvent({ seriesKey: "community_dance" });
    const res = await ATTEND(
      jsonReq("POST", `/api/events/${evt.id}/attendance`, {
        newContact: { firstName: "New", lastName: "Fiddler" },
        isOpenBand: true,
      }),
      ctx({ id: evt.id }),
    );
    expect(res.status).toBe(201);
    const dr = await db.query.doorRecords.findFirst({ where: eq(doorRecords.eventId, evt.id) });
    expect(dr?.openBandCount).toBe(1);
  });

  it("rejects the flag on a non-community_dance event (FR-022)", async () => {
    const evt = await makeEvent({ seriesKey: "tnc" });
    const musician = await createContact(db, { firstName: "Wrong", lastName: "Series" });
    const res = await ATTEND(
      jsonReq("POST", `/api/events/${evt.id}/attendance`, {
        contactId: musician.id,
        isOpenBand: true,
      }),
      ctx({ id: evt.id }),
    );
    expect(res.status).toBe(422);
  });

  it("rejects the flag when the contact is a booked performer for the event (FR-022a)", async () => {
    const evt = await makeEvent({ seriesKey: "community_dance" });
    const perf = await makePerformer("Fiona Fiddle"); // auto-creates a linked contact
    await createBooking(db, evt.id, {
      performerId: perf.id,
      performerType: "musician",
      pay: 100,
    });

    const res = await ATTEND(
      jsonReq("POST", `/api/events/${evt.id}/attendance`, {
        contactId: perf.contactId,
        isOpenBand: true,
      }),
      ctx({ id: evt.id }),
    );
    expect(res.status).toBe(422);
  });

  it("rejects the flag on the unmatched variant", async () => {
    const evt = await makeEvent({ seriesKey: "community_dance" });
    const res = await ATTEND(
      jsonReq("POST", `/api/events/${evt.id}/attendance`, { unmatched: true, isOpenBand: true }),
      ctx({ id: evt.id }),
    );
    expect(res.status).toBe(422);
  });
});
