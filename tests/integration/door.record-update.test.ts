import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { jsonReq, ctx } from "./helpers/http";
import { makeEvent } from "./helpers/factories";
import { doorRecords } from "@/server/db/schema";
import { POST as CREATE_DR } from "@/app/api/door-records/route";
import { PATCH as PATCH_DR } from "@/app/api/door-records/[id]/route";

// FR-006, FR-007, FR-008
describe("PATCH /api/door-records/:id", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  async function makeDoorRecord() {
    const evt = await makeEvent();
    const res = await CREATE_DR(jsonReq("POST", "/api/door-records", { eventId: evt.id }), ctx());
    return (await res.json()).id as string;
  }

  it("computes deposit, persists gift-card count, and OMITS the POS fee from the response", async () => {
    const id = await makeDoorRecord();
    const res = await PATCH_DR(
      jsonReq("PATCH", `/api/door-records/${id}`, {
        posTransactionCount: 10,
        posGross: 100,
        grossCash: 200,
        seedFloat: 15,
        cashPaidOut: 25,
        cashPaidOutReason: "performer cash",
        giftCardRedemptionCount: 3,
      }),
      ctx({ id }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deposit).toBe(160); // 200 - 15 - 25
    expect(body.giftCardRedemptionCount).toBe(3);
    // No fee-bearing field is exposed (FR-007). Check keys, not the raw JSON
    // string, since random UUIDs can contain the hex substring "fee".
    const feeKeys = Object.keys(body).filter((k) => k.toLowerCase().includes("fee"));
    expect(feeKeys).toEqual([]);

    // fee is stored server-side (319 cents) even though it is never returned
    const row = await db.query.doorRecords.findFirst({ where: eq(doorRecords.id, id) });
    expect(row?.posFeeCents).toBe(319);
  });

  it("requires a reason when cash is paid out (422)", async () => {
    const id = await makeDoorRecord();
    const res = await PATCH_DR(
      jsonReq("PATCH", `/api/door-records/${id}`, { grossCash: 100, cashPaidOut: 20 }),
      ctx({ id }),
    );
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe("CASH_PAYOUT_REASON_REQUIRED");
  });
});
