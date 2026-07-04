import { eq } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import { events, venues } from "@/server/db/schema";
import type { VenueRow } from "@/server/db/schema";
import { errors } from "@/server/lib/apiError";
import { writeAudit } from "@/server/lib/audit";
import type { VenueCreateInput, VenuePatchInput } from "@/server/validation/venues";

export async function createVenue(
  db: Db,
  input: VenueCreateInput,
  actor: string | null = null,
): Promise<VenueRow> {
  const [row] = await db
    .insert(venues)
    .values({
      name: input.name,
      address: input.address,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
    })
    .returning();
  if (!row) throw new Error("venue insert failed");
  writeAudit({ kind: "venue.created", actor, details: { venueId: row.id, name: row.name } });
  return row;
}

export async function listVenues(db: Db): Promise<VenueRow[]> {
  return db.select().from(venues).orderBy(venues.name);
}

export async function getVenue(db: Db, id: string): Promise<VenueRow> {
  const row = await db.query.venues.findFirst({ where: eq(venues.id, id) });
  if (!row) throw errors.venueNotFound();
  return row;
}

export async function patchVenue(
  db: Db,
  id: string,
  input: VenuePatchInput,
  actor: string | null = null,
): Promise<VenueRow> {
  const existing = await db.query.venues.findFirst({ where: eq(venues.id, id) });
  if (!existing) throw errors.venueNotFound();
  const [row] = await db
    .update(venues)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.address !== undefined ? { address: input.address } : {}),
      ...(input.latitude !== undefined ? { latitude: input.latitude } : {}),
      ...(input.longitude !== undefined ? { longitude: input.longitude } : {}),
      updatedAt: new Date(),
    })
    .where(eq(venues.id, id))
    .returning();
  if (!row) throw errors.venueNotFound();
  writeAudit({ kind: "venue.updated", actor, details: { venueId: id } });
  return row;
}

/** Assign (or clear, with null) a venue on an event. 404s on unknown event or venue. */
export async function assignVenueToEvent(db: Db, eventId: string, venueId: string | null): Promise<void> {
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) throw errors.eventNotFound();
  if (venueId !== null) {
    const venue = await db.query.venues.findFirst({ where: eq(venues.id, venueId) });
    if (!venue) throw errors.venueNotFound();
  }
  await db.update(events).set({ venueId }).where(eq(events.id, eventId));
}
