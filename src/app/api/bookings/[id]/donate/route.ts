import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { donateBookingAtSettlement } from "@/server/domain/bookings/bookingService";

// Feature 030 (FR-007/008): the FS donates a performer's fee at settlement — flips the booking to donated
// without holding `booking.write`. Gated on the FS's `performer_payment.write` (scoped to the event's
// series); refuses a live-paid or already-donated booking inside the service.
export const POST = withAuth<{ id: string }>(
  { requires: "performer_payment.write" },
  async (req, ctx) => {
    const { id } = await ctx.params;
    const actor = req.headers.get("x-actor") ?? "admin";
    const booking = await donateBookingAtSettlement(db, id, actor, ctx.actor);
    return NextResponse.json(booking);
  },
);
