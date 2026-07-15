import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { events } from "@/server/db/schema";
import { withAuth } from "@/server/auth/withAuth";
import { parseBody } from "@/server/lib/parseBody";
import { errors } from "@/server/lib/apiError";
import { assignVenueSchema } from "@/server/validation/venues";
import { assignVenueToEvent, setEventRent } from "@/server/domain/venues/venueService";
import { updateEventDetails } from "@/server/domain/events/eventService";

export const PATCH = withAuth<{ id: string }>(async (req, ctx) => {
  const { id } = await ctx.params;
  const input = await parseBody(req, assignVenueSchema);
  const actor = req.headers.get("x-actor") ?? "admin";
  // Apply only the fields provided (011: rentCents override; 013: label/start time/description). null clears.
  if (input.venueId !== undefined) await assignVenueToEvent(db, id, input.venueId);
  if (input.rentCents !== undefined) await setEventRent(db, id, input.rentCents, actor);
  if (input.label !== undefined || input.startTime !== undefined || input.description !== undefined) {
    await updateEventDetails(db, id, {
      label: input.label,
      startTime: input.startTime,
      description: input.description,
    });
  }
  const event = await db.query.events.findFirst({ where: eq(events.id, id) });
  if (!event) throw errors.eventNotFound();
  return NextResponse.json(event);
});
