import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { listPerformerPayments } from "@/server/domain/payments/performerPaymentService";

// FR-008: money is open to every volunteer (feature 016) — reading is 'base'; only recording is gated.
export const GET = withAuth<{ id: string }>({ requires: "base" }, async (_req, ctx) => {
  const { id } = await ctx.params;
  const result = await listPerformerPayments(db, id);
  return NextResponse.json(result);
});
