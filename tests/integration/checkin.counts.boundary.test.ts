import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb } from "./helpers/db";
import { jsonReqAs, ctx } from "./helpers/http";
import { makeActor, makeEvent } from "./helpers/factories";
import { POST as CHECKIN_COUNTS } from "@/app/api/events/[id]/checkin-counts/route";

// Feature 017 (B29 / FR-018, FR-023): capturing comp + gift counts at check-in is an `attendance.write`
// capability — the Door Attendant may do it WITHOUT any /gate (money) access. (The mirror boundary —
// the Door Attendant refused every gate.write — is covered in authz.boundaries.test.ts.)
describe("check-in counts: Door Attendant may capture without /gate access", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("a club-wide Door Attendant may POST /checkin-counts", async () => {
    const evt = await makeEvent({ seriesKey: "tnc" });
    const { token } = await makeActor({
      email: "door.counts@cdrochester.org",
      grants: [{ role: "door_attendant" }],
    });

    const res = await CHECKIN_COUNTS(
      jsonReqAs(token, "POST", `/api/events/${evt.id}/checkin-counts`, {
        compCount: 2,
        giftCardRedemptionCount: 1,
      }),
      ctx({ id: evt.id }),
    );
    expect(res.status).toBe(200);
    const view = await res.json();
    expect(view.compCount).toBe(2);
    expect(view.giftCardRedemptionCount).toBe(1);
  });
});
