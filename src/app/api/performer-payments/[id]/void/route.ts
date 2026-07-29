import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { parseBody } from "@/server/lib/parseBody";
import { performerPaymentVoidSchema } from "@/server/validation/payments";
import { voidPerformerPayment } from "@/server/domain/payments/performerPaymentService";

// Feature 023: void a check (persists as voided; the treasurer records the void). FS / Treasurer scope.
export const POST = withAuth<{ id: string }>(
  { requires: "performer_payment.write" },
  async (req, ctx) => {
    const { id } = await ctx.params;
    const input = await parseBody(req, performerPaymentVoidSchema);
    const actor = req.headers.get("x-actor") ?? "admin";
    const payment = await voidPerformerPayment(db, id, input.reason, actor, ctx.actor);
    return NextResponse.json(payment);
  },
);
