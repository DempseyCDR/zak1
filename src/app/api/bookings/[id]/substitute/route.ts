import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { parseBody } from "@/server/lib/parseBody";
import { substitutePerformerSchema } from "@/server/validation/performers";
import { substitutePerformer } from "@/server/domain/bookings/bookingService";

// Feature 024 US3: substitute a performer on a booking. Unpaid → clean re-point; live-paid → keep the
// no-show + add a fresh booking for the substitute. Feature 043 (P6-R12): layer-1 is `base` (authenticated);
// the real gate is layer-2 in substitutePerformer, which accepts EITHER booking.write (Booker) OR
// performer_payment.write (FS) in the event's scope — so the FS substitutes on /payments without a 403.
export const POST = withAuth<{ id: string }>({ requires: "base" }, async (req, ctx) => {
  const { id } = await ctx.params;
  const input = await parseBody(req, substitutePerformerSchema);
  const actor = req.headers.get("x-actor") ?? "admin";
  const result = await substitutePerformer(db, id, input.newPerformerId, actor, ctx.actor);
  return NextResponse.json(result, { status: 201 });
});
