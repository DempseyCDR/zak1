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
    const drId = await makeDoorRecord(evt.id, [
      { category: "today_admission", paymentMethod: "card", amount: 100 },
    ]);
    // 10 txns + $100 gross → door fee = 90c + 229c = 319c = $3.19
    await updateDoorRecord(db, drId, { posTransactionCount: 10, posGross: 100 });

    const res = await REPORT(jsonReq("GET", `/api/events/${evt.id}/treasurer-report`), ctx({ id: evt.id }));
    const body = await res.json();

    expect(body.fees.doorFee).toBe(3.19);
    expect(body.fees.onlineFee).toBe(0);
    // revenue line reported at gross (not reduced by the fee)
    const adm = body.gateSalesSummary.lines.find((l: { category: string }) => l.category === "today_admission");
    expect(adm.total).toBe(100);
  });
});
