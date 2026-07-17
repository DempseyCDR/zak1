import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { jsonReq, ctx } from "./helpers/http";
import { makeEvent } from "./helpers/factories";
import { doorRecords } from "@/server/db/schema";
import { updateDoorRecord } from "@/server/domain/door/doorRecordService";
import { POST as CHECKIN_COUNTS } from "@/app/api/events/[id]/checkin-counts/route";

// Feature 017 (B29): the Door Attendant captures comp + gift-card redemption counts at check-in,
// materialized on the door record; the FS confirms/edits them on /gate (gate.write). Resolves B21.
describe("POST /api/events/:id/checkin-counts (comp + gift capture at check-in)", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("ensures the door record and sets only the two counts (no money, no open-band)", async () => {
    const evt = await makeEvent();
    const res = await CHECKIN_COUNTS(
      jsonReq("POST", `/api/events/${evt.id}/checkin-counts`, {
        compCount: 4,
        giftCardRedemptionCount: 1,
      }),
      ctx({ id: evt.id }),
    );
    expect(res.status).toBe(200);

    const dr = await db.query.doorRecords.findFirst({ where: eq(doorRecords.eventId, evt.id) });
    expect(dr?.compCount).toBe(4);
    expect(dr?.giftCardRedemptionCount).toBe(1);
    // Money and the open-band tally are untouched by a check-in count write.
    expect(dr?.grossCashCents).toBe(0);
    expect(dr?.pcGrossCents).toBe(0);
    expect(dr?.openBandCount).toBe(0);
  });

  it("leaves an omitted count unchanged on a second write", async () => {
    const evt = await makeEvent();
    await CHECKIN_COUNTS(
      jsonReq("POST", `/api/events/${evt.id}/checkin-counts`, { compCount: 3 }),
      ctx({ id: evt.id }),
    );
    await CHECKIN_COUNTS(
      jsonReq("POST", `/api/events/${evt.id}/checkin-counts`, { giftCardRedemptionCount: 2 }),
      ctx({ id: evt.id }),
    );

    const dr = await db.query.doorRecords.findFirst({ where: eq(doorRecords.eventId, evt.id) });
    expect(dr?.compCount).toBe(3); // preserved
    expect(dr?.giftCardRedemptionCount).toBe(2);
  });

  it("the FS can still edit the captured counts on /gate (FR-015)", async () => {
    const evt = await makeEvent();
    await CHECKIN_COUNTS(
      jsonReq("POST", `/api/events/${evt.id}/checkin-counts`, { compCount: 4 }),
      ctx({ id: evt.id }),
    );
    const dr = await db.query.doorRecords.findFirst({ where: eq(doorRecords.eventId, evt.id) });
    // FS override during reconciliation (default test session is a super_user → holds gate.write).
    const updated = await updateDoorRecord(db, dr!.id, { compCount: 5 });
    expect(updated.compCount).toBe(5);
  });
});
