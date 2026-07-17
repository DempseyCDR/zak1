import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { jsonReq, jsonReqAs, ctx } from "./helpers/http";
import { makeActor, makeEvent } from "./helpers/factories";
import { createContact } from "@/server/domain/contacts/contactService";
import { doorRecords } from "@/server/db/schema";
import { updateDoorRecord } from "@/server/domain/door/doorRecordService";
import { POST as ATTEND } from "@/app/api/events/[id]/attendance/route";

// Feature 017 (B29): comp + gift-card redemption are per-check-in booleans that MATERIALIZE into the
// door record's counts (counts-only, never attributed). The FS overrides on /gate. Resolves B21.
describe("POST /api/events/:id/attendance (comp + gift booleans)", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  async function doorFor(eventId: string) {
    return db.query.doorRecords.findFirst({ where: eq(doorRecords.eventId, eventId) });
  }

  it("a comped check-in ensures the door record and increments comp_count only", async () => {
    const evt = await makeEvent();
    const c = await createContact(db, { firstName: "Comp", lastName: "Ed" });
    const res = await ATTEND(
      jsonReq("POST", `/api/events/${evt.id}/attendance`, { contactId: c.id, isComp: true }),
      ctx({ id: evt.id }),
    );
    expect(res.status).toBe(201);

    const dr = await doorFor(evt.id);
    expect(dr?.compCount).toBe(1);
    expect(dr?.giftCardRedemptionCount).toBe(0);
    expect(dr?.openBandCount).toBe(0);
    expect(dr?.grossCashCents).toBe(0); // never touches money
  });

  it("a gift-card check-in increments gift_card_redemption_count; counts accumulate", async () => {
    const evt = await makeEvent();
    const a = await createContact(db, { firstName: "Gift", lastName: "One" });
    const b = await createContact(db, { firstName: "Gift", lastName: "Two" });
    await ATTEND(
      jsonReq("POST", `/api/events/${evt.id}/attendance`, {
        contactId: a.id,
        redeemedGiftCard: true,
      }),
      ctx({ id: evt.id }),
    );
    await ATTEND(
      jsonReq("POST", `/api/events/${evt.id}/attendance`, {
        contactId: b.id,
        isComp: true,
        redeemedGiftCard: true,
      }),
      ctx({ id: evt.id }),
    );

    const dr = await doorFor(evt.id);
    expect(dr?.giftCardRedemptionCount).toBe(2);
    expect(dr?.compCount).toBe(1);
  });

  it("allows a comp on an anonymous unmatched admission", async () => {
    const evt = await makeEvent();
    const res = await ATTEND(
      jsonReq("POST", `/api/events/${evt.id}/attendance`, { unmatched: true, isComp: true }),
      ctx({ id: evt.id }),
    );
    expect(res.status).toBe(201);
    const dr = await doorFor(evt.id);
    expect(dr?.compCount).toBe(1);
  });

  it("lets the FS override the materialized counts on /gate (FR-015)", async () => {
    const evt = await makeEvent();
    const c = await createContact(db, { firstName: "Over", lastName: "Ride" });
    await ATTEND(
      jsonReq("POST", `/api/events/${evt.id}/attendance`, { contactId: c.id, isComp: true }),
      ctx({ id: evt.id }),
    );
    const dr = await doorFor(evt.id);
    const updated = await updateDoorRecord(db, dr!.id, { compCount: 5 });
    expect(updated.compCount).toBe(5);
  });

  it("the Door Attendant captures comps via check-in without any /gate access", async () => {
    const evt = await makeEvent({ seriesKey: "tnc" });
    const { token } = await makeActor({
      email: "door.comp@cdrochester.org",
      grants: [{ role: "door_attendant" }],
    });
    const res = await ATTEND(
      jsonReqAs(token, "POST", `/api/events/${evt.id}/attendance`, {
        unmatched: true,
        isComp: true,
      }),
      ctx({ id: evt.id }),
    );
    expect(res.status).toBe(201);
    const dr = await doorFor(evt.id);
    expect(dr?.compCount).toBe(1);
  });
});
