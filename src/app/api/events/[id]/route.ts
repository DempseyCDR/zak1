import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { events } from "@/server/db/schema";
import { withLogging } from "@/server/lib/withLogging";
import { parseBody } from "@/server/lib/parseBody";
import { errors } from "@/server/lib/apiError";
import { assignVenueSchema } from "@/server/validation/venues";
import { assignVenueToEvent } from "@/server/domain/venues/venueService";

export const PATCH = withLogging<{ id: string }>(async (req, ctx) => {
  const { id } = await ctx.params;
  const input = await parseBody(req, assignVenueSchema);
  await assignVenueToEvent(db, id, input.venueId);
  const event = await db.query.events.findFirst({ where: eq(events.id, id) });
  if (!event) throw errors.eventNotFound();
  return NextResponse.json(event);
});
