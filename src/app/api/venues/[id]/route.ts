import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withLogging } from "@/server/lib/withLogging";
import { parseBody } from "@/server/lib/parseBody";
import { venuePatchSchema } from "@/server/validation/venues";
import { getVenue, patchVenue } from "@/server/domain/venues/venueService";

export const GET = withLogging<{ id: string }>(async (_req, ctx) => {
  const { id } = await ctx.params;
  const venue = await getVenue(db, id);
  return NextResponse.json(venue);
});

export const PATCH = withLogging<{ id: string }>(async (req, ctx) => {
  const { id } = await ctx.params;
  const input = await parseBody(req, venuePatchSchema);
  const actor = req.headers.get("x-actor") ?? "admin";
  const venue = await patchVenue(db, id, input, actor);
  return NextResponse.json(venue);
});
