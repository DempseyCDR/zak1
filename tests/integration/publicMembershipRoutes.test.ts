import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { ctx } from "./helpers/http";
import { resetRateLimits } from "@/server/lib/rateLimit";
import { paypalNotifications } from "@/server/db/schema";
import { POST as CAPTURE } from "@/app/api/public/membership/route";
import { POST as WEBHOOK } from "@/app/api/webhooks/paypal/route";

// Feature 019 US3 (R2): the two PUBLIC routes. No session; the webhook trusts only the (injected here)
// verification outcome. These assert the HTTP contract; the domain behavior is covered in paypalCapture.
function publicReq(path: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("public membership routes", () => {
  beforeAll(ensureSchema);
  beforeEach(async () => {
    await resetDb();
    resetRateLimits();
  });
  afterAll(closeDb);

  it("capture returns ONLY a captureId (no member/finance data leaks), 201", async () => {
    const res = await CAPTURE(
      publicReq(
        "/api/public/membership",
        { name: "Jane", email: "jane@ex.com" },
        {
          "x-forwarded-for": "1.1.1.1",
        },
      ),
      ctx(),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(Object.keys(body)).toEqual(["captureId"]);
  });

  it("capture rate-limits a burst from one IP with 429", async () => {
    let last = 200;
    for (let i = 0; i < 12; i++) {
      const res = await CAPTURE(
        publicReq(
          "/api/public/membership",
          { name: "Flood", email: `f${i}@ex.com` },
          {
            "x-forwarded-for": "9.9.9.9",
          },
        ),
        ctx(),
      );
      last = res.status;
    }
    expect(last).toBe(429);
  });

  it("webhook rejects a malformed payload with 400, storing nothing", async () => {
    const res = await WEBHOOK(publicReq("/api/webhooks/paypal", "not json"), ctx());
    expect(res.status).toBe(400);
    expect(await db.select().from(paypalNotifications)).toHaveLength(0);
  });

  it("webhook without valid PayPal signature headers is 401 (unverifiable), storing nothing", async () => {
    // No paypal-transmission-* headers → verifyPaypalWebhook returns false → 401.
    const res = await WEBHOOK(
      publicReq("/api/webhooks/paypal", {
        id: "evt-x",
        event_type: "PAYMENT.CAPTURE.COMPLETED",
        resource: { amount: { value: "25.00" }, payer: { email_address: "x@ex.com" } },
      }),
      ctx(),
    );
    expect(res.status).toBe(401);
    expect(await db.select().from(paypalNotifications)).toHaveLength(0);
  });
});
