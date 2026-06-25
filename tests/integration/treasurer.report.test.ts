import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { jsonReq, ctx } from "./helpers/http";
import { makeEvent, makeDoorRecord, makePerformer } from "./helpers/factories";
import { treasurerReportAudit } from "@/server/db/schema";
import { updateDoorRecord } from "@/server/domain/door/doorRecordService";
import { createBooking } from "@/server/domain/bookings/bookingService";
import { GET as REPORT } from "@/app/api/events/[id]/treasurer-report/route";

// FR-001/003/004/005/006/007/012/014
describe("GET /api/events/:id/treasurer-report", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  async function report(eventId: string) {
    const res = await REPORT(jsonReq("GET", `/api/events/${eventId}/treasurer-report`), ctx({ id: eventId }));
    return { status: res.status, body: await res.json() };
  }

  it("assembles all sections with mapping, named-customer split, and gift-card liability", async () => {
    const evt = await makeEvent({ seriesKey: "tnc" });
    await makeDoorRecord(evt.id, [
      { category: "today_admission", paymentMethod: "cash", amount: 120 },
      { category: "today_admission", paymentMethod: "card", amount: 80 },
      { category: "gift_card", paymentMethod: "card", amount: 25 },
      { category: "membership", paymentMethod: "card", amount: 40 },
    ]);
    const caller = await makePerformer("Pat Caller");
    await createBooking(db, evt.id, { performerId: caller.id, performerType: "caller", pay: 150 });

    const { status, body } = await report(evt.id);
    expect(status).toBe(200);

    // Gate summary: anonymous customer, today_admission mapped to 4210, gift_card to 2201 liability
    expect(body.gateSalesSummary.customer).toBe("Contra Gate");
    const adm = body.gateSalesSummary.lines.find((l: { category: string }) => l.category === "today_admission");
    expect(adm.account).toBe("4210");
    expect(adm.total).toBe(200);
    const gc = body.gateSalesSummary.lines.find((l: { category: string }) => l.category === "gift_card");
    expect(gc.account).toBe("2201");
    // membership is NOT on the gate receipt
    expect(body.gateSalesSummary.lines.find((l: { category: string }) => l.category === "membership")).toBeUndefined();

    // Named-customer receipt for membership → 4300
    const mem = body.namedCustomerReceipts.find((r: { kind: string }) => r.kind === "membership");
    expect(mem.account).toBe("4300");
    expect(mem.amount).toBe(40);

    // Performer payment mapped to caller account 5320
    expect(body.performerPayments[0].account).toBe("5320");
    expect(body.performerPayments[0].amount).toBe(150);

    // a report-generation audit row was written (FR-014)
    const audits = await db
      .select()
      .from(treasurerReportAudit)
      .where(eq(treasurerReportAudit.eventId, evt.id));
    expect(audits.length).toBe(1);
  });

  it("computes deposit and shows POS verification", async () => {
    const evt = await makeEvent();
    const drId = await makeDoorRecord(evt.id, [
      { category: "today_admission", paymentMethod: "cash", amount: 200 },
    ]);
    await updateDoorRecord(db, drId, {
      posTransactionCount: 10,
      posGross: 100,
      grossCash: 200,
      seedFloat: 15,
    });
    const { body } = await report(evt.id);
    expect(body.deposit.account).toBe("1021");
    expect(body.deposit.amount).toBe(185); // 200 - 15
    expect(body.gateSalesSummary.posVerification.gross).toBe(100);
  });

  it("404s when the event has no door record", async () => {
    const evt = await makeEvent();
    const { status, body } = await report(evt.id);
    expect(status).toBe(404);
    expect(body.error.code).toBe("DOOR_RECORD_NOT_FOUND");
  });
});
