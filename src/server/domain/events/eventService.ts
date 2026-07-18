import { and, eq, gte, isNotNull, lte } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import { attendance, bookings, doorRecords, eventGroups, events, series } from "@/server/db/schema";
import type { EventGroupRow, EventRow, EventStatus } from "@/server/db/schema";
import { errors } from "@/server/lib/apiError";
import { assertScope, assertEventScope } from "@/server/auth/can";
import type { Actor } from "@/server/auth/actor";
import { writeAudit } from "@/server/lib/audit";
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

/**
 * Set/clear an event's editable fields. Only provided keys are applied; null clears (feature 013 display
 * fields; feature 018 adds eventDate reschedule, status cancel/revive, and the advertised price). The
 * FIELD-LEVEL authorization (which role may write which field) is enforced by `assertFields` in the route
 * before this is called.
 */
export async function updateEventDetails(
  db: Db,
  eventId: string,
  input: {
    label?: string | null;
    startTime?: string | null;
    description?: string | null;
    eventDate?: string;
    status?: EventStatus;
    advertisedPriceCents?: number | null;
  },
): Promise<void> {
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) throw errors.eventNotFound();
  await db
    .update(events)
    .set({
      ...(input.label !== undefined ? { label: input.label } : {}),
      ...(input.startTime !== undefined ? { startTime: input.startTime } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.eventDate !== undefined ? { eventDate: input.eventDate } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.advertisedPriceCents !== undefined
        ? { advertisedPriceCents: input.advertisedPriceCents }
        : {}),
    })
    .where(eq(events.id, eventId));
}

/**
 * Feature 018 (B25): hard-delete an event, but ONLY when it has no history. Refuses (409) if the event has
 * a door record, any attendance row, or a booking with a check number (an actual recorded payment — a
 * non-zero booked rate alone does not block). For a real event that will not happen, use cancel (status).
 */
export async function deleteEvent(
  db: Db,
  eventId: string,
  actor: string | null = null,
  authz?: Actor,
): Promise<void> {
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) throw errors.eventNotFound();
  if (authz) {
    assertEventScope(authz, "event.write", { seriesId: event.seriesId, groupId: event.groupId });
  }

  const door = await db.query.doorRecords.findFirst({ where: eq(doorRecords.eventId, eventId) });
  const attended = await db.query.attendance.findFirst({ where: eq(attendance.eventId, eventId) });
  const paidBooking = await db.query.bookings.findFirst({
    where: and(eq(bookings.eventId, eventId), isNotNull(bookings.checkNumber)),
  });
  if (door || attended || paidBooking) throw errors.eventHasHistory();

  await db.delete(events).where(eq(events.id, eventId)); // FK cascades remove any proposed bookings
  writeAudit({ kind: "event.deleted", actor, details: { eventId } });
}

/**
 * Feature 018 (B26): the dates a recurrence run generates — from `firstDate`, stepping every
 * `everyNWeeks` weeks, through `lastDate` inclusive. Pure (UTC math, no TZ drift); empty when the range
 * yields nothing (e.g. last before first).
 */
export function recurringDates(firstDate: string, everyNWeeks: number, lastDate: string): string[] {
  const dates: string[] = [];
  const stepMs = everyNWeeks * 7 * 86_400_000;
  const last = new Date(`${lastDate}T00:00:00Z`).getTime();
  for (let t = new Date(`${firstDate}T00:00:00Z`).getTime(); t <= last; t += stepMs) {
    dates.push(new Date(t).toISOString().slice(0, 10));
  }
  return dates;
}

const RECURRENCE_CAP = 60;

/**
 * Feature 018 (B26): generate many INDEPENDENT event rows over a date range (no live recurrence rule).
 * Refuses (422) a run that would exceed the per-run cap; an empty range creates nothing.
 */
export async function generateRecurringEvents(
  db: Db,
  input: {
    seriesKey: string;
    firstDate: string;
    lastDate: string;
    everyNWeeks: number;
    startTime?: string;
    groupId?: string;
    chargesAdmission: boolean;
  },
  actor?: Actor,
): Promise<EventRow[]> {
  const s = await db.query.series.findFirst({ where: eq(series.key, input.seriesKey) });
  if (!s) throw errors.seriesNotFound();
  if (input.groupId) {
    const g = await db.query.eventGroups.findFirst({ where: eq(eventGroups.id, input.groupId) });
    if (!g) throw errors.eventGroupNotFound();
  }
  if (actor) assertScope(actor, "event.write", { seriesId: s.id, groupId: input.groupId ?? null });

  const dates = recurringDates(input.firstDate, input.everyNWeeks, input.lastDate);
  if (dates.length === 0) return [];
  if (dates.length > RECURRENCE_CAP) throw errors.recurrenceTooLarge(RECURRENCE_CAP);

  const rows = await db
    .insert(events)
    .values(
      dates.map((eventDate) => ({
        seriesId: s.id,
        groupId: input.groupId ?? null,
        eventDate,
        chargesAdmission: input.chargesAdmission,
        startTime: input.startTime ?? null,
      })),
    )
    .returning();
  writeAudit({
    kind: "event.generated",
    actor: null,
    details: { seriesKey: input.seriesKey, count: rows.length },
  });
  return rows;
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
