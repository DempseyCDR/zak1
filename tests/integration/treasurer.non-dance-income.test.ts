import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { jsonReq, ctx } from "./helpers/http";
import { makeEvent, makeDoorRecord } from "./helpers/factories";
import { updateDoorRecord } from "@/server/domain/door/doorRecordService";
import { POST as ADD_NDI } from "@/app/api/events/[id]/non-dance-income/route";
import { GET as REPORT } from "@/app/api/events/[id]/treasurer-report/route";

// FR-010
describe("non-dance income section", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("appears as a separate section (acct 4910), excluded from gate totals", async () => {
    const evt = await makeEvent();
    const drId = await makeDoorRecord(evt.id);
    await updateDoorRecord(db, drId, { grossCash: 100, seedFloat: 0 }); // admission derived = 100
    await ADD_NDI(
      jsonReq("POST", `/api/events/${evt.id}/non-dance-income`, {
        description: "ESL bank interest",
        amount: 12.5,
        entryDate: "2026-06-30",
      }),
      ctx({ id: evt.id }),
    );

    const res = await REPORT(jsonReq("GET", `/api/events/${evt.id}/treasurer-report`), ctx({ id: evt.id }));
    const body = await res.json();
    expect(body.nonDanceIncome.account).toBe("4910");
    expect(body.nonDanceIncome.total).toBe(12.5);
    expect(body.nonDanceIncome.lines[0].description).toBe("ESL bank interest");
    // not part of the gate summary
    const gateTotal = body.gateSalesSummary.lines.reduce((a: number, l: { total: number }) => a + l.total, 0);
    expect(gateTotal).toBe(100);
  });
});
