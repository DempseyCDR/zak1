import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withLogging } from "@/server/lib/withLogging";
import { parseBody } from "@/server/lib/parseBody";
import { bookingPatchSchema } from "@/server/validation/performers";
import { patchBooking } from "@/server/domain/bookings/bookingService";

export const PATCH = withLogging<{ id: string }>(async (req, ctx) => {
  const { id } = await ctx.params;
  const input = await parseBody(req, bookingPatchSchema);
  const actor = req.headers.get("x-actor") ?? "admin";
  const booking = await patchBooking(db, id, input, actor);
  return NextResponse.json(booking);
});
