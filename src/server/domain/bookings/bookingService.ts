import { and, eq, ne } from "drizzle-orm";
import type { Db, DbOrTx } from "@/server/db/client";
import { bookings, events, performers, series } from "@/server/db/schema";
import type { BookingRow, PerformerType } from "@/server/db/schema";
import { errors } from "@/server/lib/apiError";
import { assertEventScope } from "@/server/auth/can";
import type { Actor } from "@/server/auth/actor";
import { writeAudit } from "@/server/lib/audit";
import { centsToDollars, dollarsToCents } from "@/server/lib/money";
import { PERFORMER_RULES, bookingRequiresCheck } from "@/server/domain/performers/performerRules";
import { resolveParameterCents } from "@/server/domain/parameters/seriesParameterService";
import { bookingHasLivePayment } from "@/server/domain/payments/performerPaymentService";
import { isAllowedBookingTransition } from "./bookingStatus";
import type { BookingCreateInput, BookingPatchInput } from "@/server/validation/performers";

/** Types that are always free regardless of input. */
function isForcedFree(type: PerformerType): boolean {
  return type === "instructor" || type === "open_band_musician";
}

export async function createBooking(
  db: DbOrTx,
  eventId: string,
  input: BookingCreateInput,
  actor: string | null = null,
  bandId: string | null = null,
  authz?: Actor,
): Promise<BookingRow> {
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) throw errors.eventNotFound();
  // Booking authority is per-series: scope to the EVENT's series/group (FR-007). A Booker-of-ecd may
  // not book performers onto a tnc event.
  assertEventScope(authz, "booking.write", { seriesId: event.seriesId, groupId: event.groupId });
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
    payCents = await resolveParameterCents(db, {
      category: "rate",
      kind: rule.rateKind,
      seriesId: event.seriesId,
      onDate: event.eventDate,
    });
  }

  const requiresCheck = bookingRequiresCheck(type, payCents);

  const [row] = await db
    .insert(bookings)
    .values({
      eventId,
      performerId: input.performerId,
      bandId,
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
  authz?: Actor,
): Promise<void> {
  await assertBookingScope(db, authz, id); // scope to the booking's event, before deleting it
  // Feature 024 (FR-005): a booking settled by a live check may not be cleared — clearing it would orphan a
  // payment line and break 023's "check total = Σ live line amounts". Void the check first, or substitute.
  if (await bookingHasLivePayment(db, id)) {
    throw errors.validation(
      "This booking is settled by a live check — void it first, or substitute the performer.",
    );
  }
  const [row] = await db.delete(bookings).where(eq(bookings.id, id)).returning({ id: bookings.id });
  if (!row) throw errors.bookingNotFound();
  writeAudit({ kind: "booking.deleted", actor, details: { bookingId: id } });
}

/** Scope a write to an existing booking, via its event's series/group (FR-007). */
async function assertBookingScope(
  db: Db,
  actor: Actor | undefined,
  bookingId: string,
): Promise<void> {
  if (!actor) return;
  const booking = await db.query.bookings.findFirst({ where: eq(bookings.id, bookingId) });
  if (!booking) throw errors.bookingNotFound();
  const event = await db.query.events.findFirst({ where: eq(events.id, booking.eventId) });
  if (!event) throw errors.eventNotFound();
  assertEventScope(actor, "booking.write", { seriesId: event.seriesId, groupId: event.groupId });
}

export async function patchBooking(
  db: Db,
  id: string,
  input: BookingPatchInput,
  actor: string | null = null,
  authz?: Actor,
): Promise<BookingRow> {
  const current = await db.query.bookings.findFirst({ where: eq(bookings.id, id) });
  if (!current) throw errors.bookingNotFound();
  await assertBookingScope(db, authz, id);

  const type = current.performerType;

  // B23 re-point: change the performer on this same slot → a fresh `proposed` booking for the new
  // performer, resetting pay/override/donated to the slot's standard rate. (A check number no longer lives
  // on the booking — feature 021; payments live on performer_payments — so there is nothing to clear here.)
  if (input.performerId !== undefined && input.performerId !== current.performerId) {
    // Feature 024 (FR-005): refuse a re-point of a booking settled by a live check — it would overwrite the
    // performer whose check line settles this slot. Void the check first, or use substitute (keeps the
    // no-show + adds a fresh booking).
    if (await bookingHasLivePayment(db, id)) {
      throw errors.validation(
        "This booking is settled by a live check — void it first, or substitute the performer.",
      );
    }
    const newPerformer = await db.query.performers.findFirst({
      where: eq(performers.id, input.performerId),
    });
    if (!newPerformer) throw errors.performerNotFound();
    const event = await db.query.events.findFirst({ where: eq(events.id, current.eventId) });
    if (!event) throw errors.eventNotFound();
    const rule = PERFORMER_RULES[type];
    let payCents = 0;
    if (!isForcedFree(type) && rule.rateKind) {
      payCents = await resolveParameterCents(db, {
        category: "rate",
        kind: rule.rateKind,
        seriesId: event.seriesId,
        onDate: event.eventDate,
      });
    }
    const [row] = await db
      .update(bookings)
      .set({
        performerId: input.performerId,
        status: "proposed",
        isOverridden: false,
        isDonated: false,
        payCents,
        requiresCheck: bookingRequiresCheck(type, payCents),
        ...(input.note !== undefined ? { note: input.note } : {}),
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, id))
      .returning();
    if (!row) throw errors.bookingNotFound();
    writeAudit({ kind: "booking.updated", actor, details: { bookingId: id, repointed: true } });
    return row;
  }

  // B23 status transition (no performer change): validate proposed→requested→confirmed / →declined.
  let status = current.status;
  if (input.status !== undefined && input.status !== current.status) {
    if (!isAllowedBookingTransition(current.status, input.status)) {
      throw errors.validation(
        `Illegal booking status transition: ${current.status} → ${input.status}.`,
      );
    }
    status = input.status;
  }

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
      status,
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

  // Feature 024 US1 (FR-001): a band LEAD's status change cascades to its lockstep siblings on the same
  // event — those still at the lead's PREVIOUS status move to the new status (status only). Keying on the
  // previous status makes every follower's move a legal transition by construction and naturally skips a
  // diverged/declined member. FR-002: only the lead cascades, and a re-point (early-returned above) does
  // not. This fires only on a direct patchBooking status change — the no-show declines set internally by
  // substitute/repointBand are direct `bookings` updates, so they bypass this (analyze H1).
  if (
    current.bandId !== null &&
    current.performerType === "lead_musician" &&
    status !== current.status
  ) {
    await db
      .update(bookings)
      .set({ status, updatedAt: new Date() })
      .where(
        and(
          eq(bookings.eventId, current.eventId),
          eq(bookings.bandId, current.bandId),
          ne(bookings.id, id),
          eq(bookings.status, current.status),
        ),
      );
    writeAudit({
      kind: "booking.updated",
      actor,
      details: { bandId: current.bandId, eventId: current.eventId, leadCascade: status },
    });
  }

  return row;
}

export type SubstituteResult = {
  /** The substitute's booking — the re-pointed slot (unpaid) or a fresh booking (paid). */
  booking: BookingRow;
  /** The original, kept as a `declined` no-show (paid branch); null when the slot was re-pointed clean. */
  noShow: BookingRow | null;
};

/**
 * Feature 024 US3 (FR-004/FR-005/FR-007): substitute a performer, branching on the written-check
 * discriminator. **Unpaid** → re-point the slot in place (the existing reset-to-`proposed` path; no record
 * of the outgoing performer kept). **Live-paid** → keep the original as a `declined` no-show and add the
 * substitute as a **new** booking (same performer_type / band), so the check line is never orphaned and the
 * person who played gets their own booking. The no-show decline is a **direct** `bookings` update (not a
 * `patchBooking` status change), so substituting a no-show LEAD does NOT trigger the FR-001 cascade — the
 * rest of the band is left intact (analyze H1). The wrong check is voided/reissued on the money side (023).
 */
export async function substitutePerformer(
  db: Db,
  bookingId: string,
  newPerformerId: string,
  actor: string | null = null,
  authz?: Actor,
): Promise<SubstituteResult> {
  const current = await db.query.bookings.findFirst({ where: eq(bookings.id, bookingId) });
  if (!current) throw errors.bookingNotFound();
  await assertBookingScope(db, authz, bookingId);
  const newPerformer = await db.query.performers.findFirst({
    where: eq(performers.id, newPerformerId),
  });
  if (!newPerformer) throw errors.performerNotFound();

  // Unpaid (or only voided) → the clean-swap path: re-point the slot in place. patchBooking's re-point
  // branch resets to `proposed`/standard rate and re-checks the discriminator (belt-and-braces).
  if (!(await bookingHasLivePayment(db, bookingId))) {
    const booking = await patchBooking(
      db,
      bookingId,
      { performerId: newPerformerId },
      actor,
      authz,
    );
    return { booking, noShow: null };
  }

  // Live-paid → keep the original as a no-show + a fresh booking for the substitute, atomically.
  const result = await db.transaction(async (tx) => {
    const [noShow] = await tx
      .update(bookings)
      .set({ status: "declined", updatedAt: new Date() })
      .where(eq(bookings.id, bookingId))
      .returning();
    if (!noShow) throw errors.bookingNotFound();
    const booking = await createBooking(
      tx,
      current.eventId,
      { performerId: newPerformerId, performerType: current.performerType },
      actor,
      current.bandId,
      authz,
    );
    return { booking, noShow };
  });
  writeAudit({
    kind: "booking.updated",
    actor,
    details: { bookingId, substitutePaid: true, newBookingId: result.booking.id },
  });
  return result;
}
