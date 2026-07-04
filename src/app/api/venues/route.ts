import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withLogging } from "@/server/lib/withLogging";
import { parseBody } from "@/server/lib/parseBody";
import { venueCreateSchema } from "@/server/validation/venues";
import { createVenue, listVenues } from "@/server/domain/venues/venueService";

export const GET = withLogging(async () => {
  const items = await listVenues(db);
  return NextResponse.json({ items });
});

export const POST = withLogging(async (req) => {
  const input = await parseBody(req, venueCreateSchema);
  const actor = req.headers.get("x-actor") ?? "admin";
  const venue = await createVenue(db, input, actor);
  return NextResponse.json(venue, { status: 201 });
});
