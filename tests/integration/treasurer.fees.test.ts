import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { jsonReq, ctx } from "./helpers/http";
import { makeEvent, makeDoorRecord } from "./helpers/factories";
import { updateDoorRecord } from "@/server/domain/door/doorRecordService";
import { GET as REPORT } from "@/app/api/events/[id]/treasurer-report/route";

// FR-009 — revenue at gross; fees shown separately (door fee from the record).
describe("treasurer report fees", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("shows the door fee in the Fees section while revenue stays gross", async () => {
    const evt = await makeEvent();
    const drId = await makeDoorRecord(evt.id);
    // PC gross $100, gross cash = seed float so admission card = 100; 10 txns → fee 90c+229c=319c
    await updateDoorRecord(db, drId, {
      grossCash: 15,
      pcGross: 100,
      seedFloat: 15,
      posTransactionCount: 10,
    });

    const res = await REPORT(
      jsonReq("GET", `/api/events/${evt.id}/treasurer-report`),
      ctx({ id: evt.id }),
    );
    const body = await res.json();

    expect(body.fees.doorFee).toBe(3.19);
    expect(body.fees.onlineFee).toBe(0);
    // revenue line reported at gross (not reduced by the fee)
    const adm = body.gateSalesSummary.lines.find(
      (l: { category: string }) => l.category === "admission",
    );
    expect(adm.total).toBe(100);
  });
});
