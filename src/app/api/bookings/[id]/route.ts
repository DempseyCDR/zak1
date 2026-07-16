import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { parseBody } from "@/server/lib/parseBody";
import { bookingPatchSchema } from "@/server/validation/performers";
import { deleteBooking, patchBooking } from "@/server/domain/bookings/bookingService";

export const PATCH = withAuth<{ id: string }>({ requires: "booking.write" }, async (req, ctx) => {
  const { id } = await ctx.params;
  const input = await parseBody(req, bookingPatchSchema);
  const actor = req.headers.get("x-actor") ?? "admin";
  const booking = await patchBooking(db, id, input, actor, ctx.actor);
  return NextResponse.json(booking);
});

export const DELETE = withAuth<{ id: string }>({ requires: "booking.write" }, async (req, ctx) => {
  const { id } = await ctx.params;
  const actor = req.headers.get("x-actor") ?? "admin";
  await deleteBooking(db, id, actor, ctx.actor);
  return NextResponse.json({ ok: true });
});
