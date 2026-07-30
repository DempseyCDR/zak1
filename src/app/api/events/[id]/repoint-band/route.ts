import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { parseBody } from "@/server/lib/parseBody";
import { repointBandSchema } from "@/server/validation/bands";
import { repointBand } from "@/server/domain/bookings/bandRepoint";

// Feature 024 US2: re-point an event's band. Removes the outgoing band's unpaid bookings, keeps any live-paid
// one as a declined no-show, and books the incoming band's current roster fresh.
export const POST = withAuth<{ id: string }>({ requires: "booking.write" }, async (req, ctx) => {
  const { id } = await ctx.params;
  const input = await parseBody(req, repointBandSchema);
  const actor = req.headers.get("x-actor") ?? "admin";
  const result = await repointBand(db, id, input.fromBandId, input.toBandId, actor, ctx.actor);
  return NextResponse.json(result, { status: 201 });
});
