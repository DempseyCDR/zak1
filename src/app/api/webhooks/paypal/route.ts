import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withPublic } from "@/server/auth/withPublic";
import { paypalWebhookSchema, extractNotification } from "@/server/validation/paypal";
import { readPaypalHeaders, verifyPaypalWebhook } from "@/server/domain/paypal/verify";
import { processNotification } from "@/server/domain/paypal/captureService";

/**
 * Feature 019 US3 (FR-011..FR-013, R2): PUBLIC — authenticity is PayPal's signature, never a session.
 * Order is the contract: parse → verify → process (insert-or-duplicate → match/park). Responses are
 * deliberately uninformative: a verified notification (matched, parked, or duplicate) is 200; malformed
 * is 400; unverifiable is 401 with nothing stored.
 */
export const POST = withPublic(async (req) => {
  const raw = await req.text();
  let payload;
  try {
    payload = paypalWebhookSchema.parse(JSON.parse(raw));
  } catch {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Malformed notification." } },
      { status: 400 },
    );
  }

  const verified = await verifyPaypalWebhook(readPaypalHeaders(req.headers), raw);
  const outcome = await processNotification(db, extractNotification(payload), payload, verified);
  if (outcome === "rejected") {
    return NextResponse.json(
      { error: { code: "UNVERIFIED", message: "Signature verification failed." } },
      { status: 401 },
    );
  }
  return NextResponse.json({ ok: true }); // matched / parked / duplicate — all 200, all uninformative
});
