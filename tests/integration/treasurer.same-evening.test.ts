import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb } from "./helpers/db";
import { jsonReq, ctx } from "./helpers/http";
import { makeEvent, makeDoorRecord } from "./helpers/factories";
import { GET as REPORT } from "@/app/api/events/[id]/treasurer-report/route";

// FR-004 — same-evening TNC + Community Dance → two reports, both "Contra Gate".
describe("same-evening events", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  async function reportCustomer(eventId: string) {
    const res = await REPORT(jsonReq("GET", `/api/events/${eventId}/treasurer-report`), ctx({ id: eventId }));
    return (await res.json()).gateSalesSummary.customer;
  }

  it("produces two gate receipts, both Contra Gate", async () => {
    const tnc = await makeEvent({ seriesKey: "tnc", eventDate: "2026-06-18" });
    const cd = await makeEvent({ seriesKey: "community_dance", eventDate: "2026-06-18" });
    await makeDoorRecord(tnc.id, [{ category: "today_admission", paymentMethod: "cash", amount: 50 }]);
    await makeDoorRecord(cd.id, [{ category: "today_admission", paymentMethod: "cash", amount: 30 }]);

    expect(await reportCustomer(tnc.id)).toBe("Contra Gate");
    expect(await reportCustomer(cd.id)).toBe("Contra Gate");
  });
});
