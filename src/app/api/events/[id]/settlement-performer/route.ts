import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { parseBody } from "@/server/lib/parseBody";
import { settlementPerformerSchema } from "@/server/validation/payments";
import { addSettlementPerformer } from "@/server/domain/bookings/bookingService";

// Feature 030 (FR-011): the FS adds a last-minute performer at settlement so they can be paid — creates the
// booking without holding `booking.write`. Gated on `performer_payment.write` (scoped to the event's
// series); dedupes an already-booked performer inside the service.
export const POST = withAuth<{ id: string }>(
  { requires: "performer_payment.write" },
  async (req, ctx) => {
    const { id } = await ctx.params;
    const input = await parseBody(req, settlementPerformerSchema);
    const actor = req.headers.get("x-actor") ?? "admin";
    const booking = await addSettlementPerformer(db, id, input, actor, ctx.actor);
    return NextResponse.json(booking, { status: 201 });
  },
);
