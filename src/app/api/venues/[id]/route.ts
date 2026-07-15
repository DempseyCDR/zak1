import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { parseBody } from "@/server/lib/parseBody";
import { venuePatchSchema } from "@/server/validation/venues";
import { getVenue, patchVenue } from "@/server/domain/venues/venueService";

export const GET = withAuth<{ id: string }>(async (_req, ctx) => {
  const { id } = await ctx.params;
  const venue = await getVenue(db, id);
  return NextResponse.json(venue);
});

export const PATCH = withAuth<{ id: string }>(async (req, ctx) => {
  const { id } = await ctx.params;
  const input = await parseBody(req, venuePatchSchema);
  const actor = req.headers.get("x-actor") ?? "admin";
  const venue = await patchVenue(db, id, input, actor);
  return NextResponse.json(venue);
});
