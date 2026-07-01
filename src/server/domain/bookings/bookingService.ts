import { eq } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import { bookings, events, performers, series } from "@/server/db/schema";
import type { BookingRow, PerformerType } from "@/server/db/schema";
import { errors } from "@/server/lib/apiError";
import { writeAudit } from "@/server/lib/audit";
import { centsToDollars, dollarsToCents } from "@/server/lib/money";
import { PERFORMER_RULES, bookingRequiresCheck } from "@/server/domain/performers/performerRules";
import { resolveRateCents } from "./resolveRate";
import type { BookingCreateInput, BookingPatchInput } from "@/server/validation/performers";

/** Types that are always free regardless of input. */
function isForcedFree(type: PerformerType): boolean {
  return type === "instructor" || type === "open_band_musician";
}

export async function createBooking(
  db: Db,
  eventId: string,
  input: BookingCreateInput,
  actor: string | null = null,
): Promise<BookingRow> {
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) throw errors.eventNotFound();
  const performer = await db.query.performers.findFirst({
    where: eq(performers.id, input.performerId),
  });
  if (!performer) throw errors.performerNotFound();

  const type = input.performerType;
  const rule = PERFORMER_RULES[type];

  // Sound Tech is not allowed where the series has no sound tech (Community Dance).
  if (type === "sound_tech") {
    const s = await db.query.series.findFirst({ where: eq(series.id, event.seriesId) });
    if (s && !s.hasSoundTech) throw errors.soundTechNotAllowed();
  }

  let payCents = 0;
  let isOverridden = false;
  let isDonated = false;

  if (isForcedFree(type)) {
    payCents = 0; // instructor / open band: always free
  } else if (input.isDonated) {
    isDonated = true; // donated fee → $0, counts appearance, excluded from earnings
  } else if (input.pay !== undefined) {
    payCents = dollarsToCents(input.pay);
    isOverridden = true;
  } else if (rule.rateKind) {
    payCents = await resolveRateCents(db, rule.rateKind, event.eventDate);
  }

  const requiresCheck = bookingRequiresCheck(type, payCents);

  const [row] = await db
    .insert(bookings)
    .values({
      eventId,
      performerId: input.performerId,
      performerType: type,
      payCents,
      isDonated,
      isOverridden,
      requiresCheck,
      note: input.note ?? null,
    })
    .returning();
  if (!row) throw new Error("booking insert failed");
  writeAudit({ kind: "booking.created", actor, details: { bookingId: row.id, eventId, type } });
  return row;
}

export type BookingView = BookingRow & { performerName: string };
export type BookingsView = {
  bookings: BookingView[];
  performerTotal: number; // dollars
};

export async function getBookingsForEvent(db: Db, eventId: string): Promise<BookingsView> {
  const rows = await db
    .select()
    .from(bookings)
    .innerJoin(performers, eq(performers.id, bookings.performerId))
    .where(eq(bookings.eventId, eventId));
  const view = rows.map((r) => ({ ...r.bookings, performerName: r.performers.displayName }));
  const totalCents = view.reduce((acc, b) => acc + b.payCents, 0);
  return { bookings: view, performerTotal: centsToDollars(totalCents) };
}

/** Remove a booking (e.g., a performer cancels). */
export async function deleteBooking(
  db: Db,
  id: string,
  actor: string | null = null,
): Promise<void> {
  const [row] = await db.delete(bookings).where(eq(bookings.id, id)).returning({ id: bookings.id });
  if (!row) throw errors.bookingNotFound();
  writeAudit({ kind: "booking.deleted", actor, details: { bookingId: id } });
}

export async function patchBooking(
  db: Db,
  id: string,
  input: BookingPatchInput,
  actor: string | null = null,
): Promise<BookingRow> {
  const current = await db.query.bookings.findFirst({ where: eq(bookings.id, id) });
  if (!current) throw errors.bookingNotFound();

  const type = current.performerType;
  let payCents = current.payCents;
  let isDonated = current.isDonated;
  let isOverridden = current.isOverridden;

  if (isForcedFree(type)) {
    payCents = 0;
  } else if (input.isDonated === true) {
    isDonated = true;
    payCents = 0;
  } else {
    if (input.isDonated === false) isDonated = false;
    if (input.pay !== undefined) {
      payCents = dollarsToCents(input.pay);
      isOverridden = true;
    }
  }

  const requiresCheck = bookingRequiresCheck(type, payCents);

  const [row] = await db
    .update(bookings)
    .set({
      payCents,
      isDonated,
      isOverridden,
      requiresCheck,
      ...(input.note !== undefined ? { note: input.note } : {}),
      updatedAt: new Date(),
    })
    .where(eq(bookings.id, id))
    .returning();
  if (!row) throw errors.bookingNotFound();
  writeAudit({ kind: "booking.updated", actor, details: { bookingId: id } });
  return row;
}
