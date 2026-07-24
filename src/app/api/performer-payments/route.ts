import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { parseBody } from "@/server/lib/parseBody";
import { performerPaymentCreateSchema } from "@/server/validation/payments";
import { createPerformerPayment } from "@/server/domain/payments/performerPaymentService";

// Feature 019 US2 (FR-009): recording actual disbursements is FS (per series) / Treasurer (club-wide).
export const POST = withAuth({ requires: "performer_payment.write" }, async (req, ctx) => {
  const input = await parseBody(req, performerPaymentCreateSchema);
  const actor = req.headers.get("x-actor") ?? "admin";
  const payment = await createPerformerPayment(db, input, actor, ctx.actor);
  return NextResponse.json(payment, { status: 201 });
});
