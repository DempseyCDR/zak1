import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { parseBody } from "@/server/lib/parseBody";
import { performerPaymentPatchSchema } from "@/server/validation/payments";
import {
  deletePerformerPayment,
  patchPerformerPayment,
} from "@/server/domain/payments/performerPaymentService";

export const PATCH = withAuth<{ id: string }>(
  { requires: "performer_payment.write" },
  async (req, ctx) => {
    const { id } = await ctx.params;
    const input = await parseBody(req, performerPaymentPatchSchema);
    const actor = req.headers.get("x-actor") ?? "admin";
    const payment = await patchPerformerPayment(db, id, input, actor, ctx.actor);
    return NextResponse.json(payment);
  },
);

export const DELETE = withAuth<{ id: string }>(
  { requires: "performer_payment.write" },
  async (req, ctx) => {
    const { id } = await ctx.params;
    const actor = req.headers.get("x-actor") ?? "admin";
    await deletePerformerPayment(db, id, actor, ctx.actor);
    return new NextResponse(null, { status: 204 });
  },
);
