import { and, eq, gte, lte } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import { eventGroups, events, series } from "@/server/db/schema";
import type { EventGroupRow, EventRow } from "@/server/db/schema";
import { errors } from "@/server/lib/apiError";
import { assertScope } from "@/server/auth/can";
import type { Actor } from "@/server/auth/actor";
import type { EventCreateInput, EventGroupCreateInput } from "@/server/validation/door";

export async function listSeries(db: Db): Promise<{ id: string; key: string; name: string }[]> {
  return db.select({ id: series.id, key: series.key, name: series.name }).from(series);
}

export async function listEventGroups(db: Db): Promise<EventGroupRow[]> {
  return db.select().from(eventGroups);
}

export async function createEventGroup(
  db: Db,
  input: EventGroupCreateInput,
): Promise<EventGroupRow> {
  const [row] = await db
    .insert(eventGroups)
    .values({ name: input.name, kind: input.kind })
    .returning();
  if (!row) throw new Error("event group insert failed");
  return row;
}

export async function createEvent(
  db: Db,
  input: EventCreateInput,
  actor?: Actor,
): Promise<EventRow> {
  const s = await db.query.series.findFirst({ where: eq(series.key, input.seriesKey) });
  if (!s) throw errors.seriesNotFound();

  if (input.groupId) {
    const g = await db.query.eventGroups.findFirst({ where: eq(eventGroups.id, input.groupId) });
    if (!g) throw errors.eventGroupNotFound();
  }

  // Layer 2 (research R5): the scoped check lands HERE, where the target is finally known — the route
  // wrapper only saw `seriesKey`, a string, and could not have resolved it without reading the body it
  // may only read once. Series and group are passed as independent filters, never a tree.
  if (actor) assertScope(actor, "event.write", { seriesId: s.id, groupId: input.groupId ?? null });

  const [row] = await db
    .insert(events)
    .values({
      seriesId: s.id,
      groupId: input.groupId ?? null,
      eventDate: input.eventDate,
      chargesAdmission: input.chargesAdmission,
      label: input.label ?? null,
      startTime: input.startTime ?? null,
      description: input.description ?? null,
    })
    .returning();
  if (!row) throw new Error("event insert failed");
  return row;
}

/** Set/clear an event's display fields (feature 013). Only provided keys are applied; null clears. */
export async function updateEventDetails(
  db: Db,
  eventId: string,
  input: { label?: string | null; startTime?: string | null; description?: string | null },
): Promise<void> {
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) throw errors.eventNotFound();
  await db
    .update(events)
    .set({
      ...(input.label !== undefined ? { label: input.label } : {}),
      ...(input.startTime !== undefined ? { startTime: input.startTime } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
    })
    .where(eq(events.id, eventId));
}

export async function listEvents(db: Db, from?: string, to?: string): Promise<EventRow[]> {
  const conds = [];
  if (from) conds.push(gte(events.eventDate, from));
  if (to) conds.push(lte(events.eventDate, to));
  return conds.length
    ? db
        .select()
        .from(events)
        .where(and(...conds))
    : db.select().from(events);
}
