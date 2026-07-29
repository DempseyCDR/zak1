import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { makeEvent, makeDoorRecord, makePerformer } from "./helpers/factories";
import { createBooking } from "@/server/domain/bookings/bookingService";
import {
  createPerformerPayment,
  voidPerformerPayment,
} from "@/server/domain/payments/performerPaymentService";
import { assembleTreasurerReport } from "@/server/domain/treasurer/reportService";

// Feature 023 US4: the per-event treasurer report lists live checks with their per-line breakdown, and voided
// checks distinctly (so the treasurer records the void into QBO too).
describe("treasurer report — payment lines + voided distinct (023)", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("emits a per-line breakdown for live checks and lists voided checks separately", async () => {
    const evt = await makeEvent();
    await makeDoorRecord(evt.id);
    const larry = await makePerformer("Live Larry");
    const vic = await makePerformer("Void Vic");
    const bL = await createBooking(
      db,
      evt.id,
      { performerId: larry.id, performerType: "musician", pay: 100 },
      "t",
    );
    const bV = await createBooking(
      db,
      evt.id,
      { performerId: vic.id, performerType: "musician", pay: 100 },
      "t",
    );
    await createPerformerPayment(db, {
      eventId: evt.id,
      payeePerformerId: larry.id,
      checkNumber: "L1",
      lines: [{ bookingId: bL.id, amount: 100 }],
    });
    const voided = await createPerformerPayment(db, {
      eventId: evt.id,
      payeePerformerId: vic.id,
      checkNumber: "V1",
      lines: [{ bookingId: bV.id, amount: 100 }],
    });
    await voidPerformerPayment(db, voided.id, "no-show");

    const report = await assembleTreasurerReport(db, evt.id);

    // Live check with its per-line allocation.
    expect(report.performerPayments).toHaveLength(1);
    const live = report.performerPayments[0]!;
    expect(live.checkNumber).toBe("L1");
    expect(live.lines).toHaveLength(1);
    expect(live.lines[0]!.performer).toBe("Live Larry");
    expect(live.lines[0]!.amount).toBe(100);

    // Voided check, distinct.
    expect(report.voidedPerformerPayments).toHaveLength(1);
    const voided2 = report.voidedPerformerPayments[0]!;
    expect(voided2.checkNumber).toBe("V1");
    expect(voided2.voidReason).toBe("no-show");
  });
});
