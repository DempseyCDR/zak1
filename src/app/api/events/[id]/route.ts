import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { events } from "@/server/db/schema";
import { withAuth } from "@/server/auth/withAuth";
import { parseBody } from "@/server/lib/parseBody";
import { errors } from "@/server/lib/apiError";
import { assignVenueSchema } from "@/server/validation/venues";
import { assignVenueToEvent, setEventRent } from "@/server/domain/venues/venueService";
import { deleteEvent, updateEventDetails } from "@/server/domain/events/eventService";
import { assertFields } from "@/server/auth/fields";

// An event is written by TWO roles for different reasons (matrix row 2): the Webmaster owns its public
// display, the Booker owns its structure. The route requires the weaker capability both hold
// (`event.public.write`); `assertFields` refuses the fields each does not own.
const EVENT_FIELDS = {
  description: "event.public.write",
  label: "event.public.write",
  startTime: "event.public.write",
  venueId: "event.write",
  rentCents: "event.write",
  // Feature 018: the Booker owns the date + cancelled state; the price is a public field both hold.
  eventDate: "event.write",
  status: "event.write",
  advertisedPriceCents: "event.public.write",
} as const;

export const PATCH = withAuth<{ id: string }>(
  { requires: "event.public.write" },
  async (req, ctx) => {
    const { id } = await ctx.params;
    const input = await parseBody(req, assignVenueSchema);
    const actor = req.headers.get("x-actor") ?? "admin";

    // Resolve the event's scope so the field checks (and any layer-2 scope) match the right series.
    const target = await db.query.events.findFirst({ where: eq(events.id, id) });
    if (!target) throw errors.eventNotFound();
    // FR-021/FR-022: refuse the whole write if it touches a field this actor may not write — BEFORE any
    // write, so a mixed submission is refused entirely, not partially applied.
    assertFields(ctx.actor, EVENT_FIELDS, input, {
      seriesId: target.seriesId,
      groupId: target.groupId,
    });

    // Apply only the fields provided (011: rentCents override; 013: label/start time/description). null clears.
    if (input.venueId !== undefined) await assignVenueToEvent(db, id, input.venueId);
    if (input.rentCents !== undefined) await setEventRent(db, id, input.rentCents, actor);
    if (
      input.label !== undefined ||
      input.startTime !== undefined ||
      input.description !== undefined ||
      input.eventDate !== undefined ||
      input.status !== undefined ||
      input.advertisedPriceCents !== undefined
    ) {
      await updateEventDetails(db, id, {
        label: input.label,
        startTime: input.startTime,
        description: input.description,
        eventDate: input.eventDate,
        status: input.status,
        advertisedPriceCents: input.advertisedPriceCents,
      });
    }
    const event = await db.query.events.findFirst({ where: eq(events.id, id) });
    if (!event) throw errors.eventNotFound();
    return NextResponse.json(event);
  },
);

// Feature 018 (B25): hard-delete an event (Booker, scoped) — refused when it has history (cancel instead).
export const DELETE = withAuth<{ id: string }>({ requires: "event.write" }, async (req, ctx) => {
  const { id } = await ctx.params;
  const actor = req.headers.get("x-actor") ?? "admin";
  await deleteEvent(db, id, actor, ctx.actor);
  return new NextResponse(null, { status: 204 });
});
