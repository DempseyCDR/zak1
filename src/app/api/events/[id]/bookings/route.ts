import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withLogging } from "@/server/lib/withLogging";
import { parseBody } from "@/server/lib/parseBody";
import { bookingCreateSchema } from "@/server/validation/performers";
import { createBooking, getBookingsForEvent } from "@/server/domain/bookings/bookingService";

export const POST = withLogging<{ id: string }>(async (req, ctx) => {
  const { id } = await ctx.params;
  const input = await parseBody(req, bookingCreateSchema);
  const actor = req.headers.get("x-actor") ?? "admin";
  const booking = await createBooking(db, id, input, actor);
  return NextResponse.json(booking, { status: 201 });
});

export const GET = withLogging<{ id: string }>(async (_req, ctx) => {
  const { id } = await ctx.params;
  const view = await getBookingsForEvent(db, id);
  return NextResponse.json(view);
});
