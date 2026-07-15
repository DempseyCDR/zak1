import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { parseBody } from "@/server/lib/parseBody";
import { venueCreateSchema } from "@/server/validation/venues";
import { createVenue, listVenues } from "@/server/domain/venues/venueService";

export const GET = withAuth(async () => {
  const items = await listVenues(db);
  return NextResponse.json({ items });
});

export const POST = withAuth(async (req) => {
  const input = await parseBody(req, venueCreateSchema);
  const actor = req.headers.get("x-actor") ?? "admin";
  const venue = await createVenue(db, input, actor);
  return NextResponse.json(venue, { status: 201 });
});
