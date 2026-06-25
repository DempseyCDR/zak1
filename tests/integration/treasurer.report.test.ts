import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { jsonReq, ctx } from "./helpers/http";
import { makeEvent, makeDoorRecord, makePerformer } from "./helpers/factories";
import { contacts, treasurerReportAudit } from "@/server/db/schema";
import { normalizeName } from "@/server/domain/contacts/normalize";
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
    const [buyer] = await db
      .insert(contacts)
      .values({ displayName: "Member Buyer", nameNormalized: normalizeName("Member Buyer") })
      .returning();
    const drId = await makeDoorRecord(evt.id, [
      { category: "gift_card", paymentMethod: "card", amount: 25 },
      { category: "membership", paymentMethod: "card", amount: 40, contactId: buyer!.id },
    ]);
    // Gross cash 120, PC gross 145; admission derived: cash 120, card 145−(25+40)=80 → total 200.
    await updateDoorRecord(db, drId, { grossCash: 120, pcGross: 145, seedFloat: 0, posTransactionCount: 10 });
    const caller = await makePerformer("Pat Caller");
    await createBooking(db, evt.id, { performerId: caller.id, performerType: "caller", pay: 150 });

    const { status, body } = await report(evt.id);
    expect(status).toBe(200);

    // Gate summary: anonymous customer, admission mapped to 4210, gift_card to 2201 liability
    expect(body.gateSalesSummary.customer).toBe("Contra Gate");
    const adm = body.gateSalesSummary.lines.find((l: { category: string }) => l.category === "admission");
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
    expect(mem.contact).toBe("Member Buyer");

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
    const drId = await makeDoorRecord(evt.id);
    await updateDoorRecord(db, drId, { grossCash: 200, pcGross: 100, seedFloat: 15 });
    const { body } = await report(evt.id);
    expect(body.deposit.account).toBe("1021");
    expect(body.deposit.amount).toBe(185); // gross cash 200 − seed 15
    expect(body.gateSalesSummary.posVerification.gross).toBe(100); // PC gross (entered)

  });

  it("derives admission from gross cash/PC gross minus all non-admission (anon + named) lines", async () => {
    const evt = await makeEvent({ seriesKey: "tnc" });
    const [a] = await db
      .insert(contacts)
      .values({ displayName: "Donor A", nameNormalized: normalizeName("Donor A") })
      .returning();
    const [b] = await db
      .insert(contacts)
      .values({ displayName: "Member B", nameNormalized: normalizeName("Member B") })
      .returning();
    const drId = await makeDoorRecord(evt.id, [
      { category: "merchandise", paymentMethod: "cash", amount: 30 },
      { category: "merchandise", paymentMethod: "card", amount: 20 },
      { category: "gift_card", paymentMethod: "cash", amount: 10 },
      { category: "misc_sales", paymentMethod: "cash", amount: 5 },
      { category: "donation", paymentMethod: "cash", amount: 25, contactId: a!.id },
      { category: "membership", paymentMethod: "card", amount: 40, contactId: b!.id },
    ]);
    // gross cash 300, seed 15, PC gross 200
    await updateDoorRecord(db, drId, { grossCash: 300, pcGross: 200, seedFloat: 15 });

    const { body } = await report(evt.id);
    const adm = body.gateSalesSummary.lines.find((l: { category: string }) => l.category === "admission");
    // cash: 300 − 15 − (30+10+5+25)=70 → 215 ; card: 200 − (20+40)=60 → 140
    expect(adm.cash).toBe(215);
    expect(adm.card).toBe(140);
    expect(adm.total).toBe(355);

    // anonymous income items are reported
    const merch = body.gateSalesSummary.lines.find((l: { category: string }) => l.category === "merchandise");
    expect(merch.total).toBe(50);
    expect(body.gateSalesSummary.lines.some((l: { category: string }) => l.category === "gift_card")).toBe(true);
    expect(body.gateSalesSummary.lines.some((l: { category: string }) => l.category === "misc_sales")).toBe(true);

    // named-customer receipts grouped by contact
    const don = body.namedCustomerReceipts.find((r: { kind: string }) => r.kind === "donation");
    expect(don.contact).toBe("Donor A");
    expect(don.amount).toBe(25);
    const mem = body.namedCustomerReceipts.find((r: { kind: string }) => r.kind === "membership");
    expect(mem.contact).toBe("Member B");
    expect(mem.amount).toBe(40);
  });

  it("404s when the event has no door record", async () => {
    const evt = await makeEvent();
    const { status, body } = await report(evt.id);
    expect(status).toBe(404);
    expect(body.error.code).toBe("DOOR_RECORD_NOT_FOUND");
  });
});
