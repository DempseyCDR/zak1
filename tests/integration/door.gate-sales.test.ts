import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb } from "./helpers/db";
import { jsonReq, ctx } from "./helpers/http";
import { makeEvent } from "./helpers/factories";
import { POST as CREATE_DR } from "@/app/api/door-records/route";
import { PUT as PUT_GATE } from "@/app/api/door-records/[id]/gate-sales/route";

// FR-005
describe("PUT /api/door-records/:id/gate-sales", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  async function makeDoorRecord() {
    const evt = await makeEvent();
    const res = await CREATE_DR(jsonReq("POST", "/api/door-records", { eventId: evt.id }), ctx());
    return (await res.json()).id as string;
  }

  it("stores categories split by cash and card", async () => {
    const id = await makeDoorRecord();
    const res = await PUT_GATE(
      jsonReq("PUT", `/api/door-records/${id}/gate-sales`, {
        sales: [
          { category: "merchandise", paymentMethod: "cash", amount: 120 },
          { category: "merchandise", paymentMethod: "card", amount: 80 },
          { category: "misc_sales", paymentMethod: "cash", amount: 25 },
        ],
      }),
      ctx({ id }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sales).toHaveLength(3);
    const merchCash = body.sales.find(
      (s: { category: string; paymentMethod: string }) =>
        s.category === "merchandise" && s.paymentMethod === "cash",
    );
    expect(merchCash.amountCents).toBe(12000);
  });

  it("rejects a named-category line (donation/future_event/membership) without a contact (422)", async () => {
    const id = await makeDoorRecord();
    const res = await PUT_GATE(
      jsonReq("PUT", `/api/door-records/${id}/gate-sales`, {
        sales: [{ category: "donation", paymentMethod: "cash", amount: 10 }],
      }),
      ctx({ id }),
    );
    expect(res.status).toBe(422);
  });

  it("rejects an unknown category (422)", async () => {
    const id = await makeDoorRecord();
    const res = await PUT_GATE(
      jsonReq("PUT", `/api/door-records/${id}/gate-sales`, {
        sales: [{ category: "bogus", paymentMethod: "cash", amount: 1 }],
      }),
      ctx({ id }),
    );
    expect(res.status).toBe(422);
  });
});
