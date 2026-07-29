import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import {
  bookings,
  events,
  paymentBookings,
  performerPayments,
  performers,
} from "@/server/db/schema";
import type { PerformerPaymentRow } from "@/server/db/schema";
import { errors } from "@/server/lib/apiError";
import { assertEventScope } from "@/server/auth/can";
import type { Actor } from "@/server/auth/actor";
import { writeAudit } from "@/server/lib/audit";
import { dollarsToCents, centsToDollars } from "@/server/lib/money";
import type {
  PerformerPaymentCreateInput,
  PerformerPaymentPatchInput,
} from "@/server/validation/payments";
import { reconcilePayments, type Reconciliation } from "./reconcile";

export type PerformerPaymentLineView = { bookingId: string; amount: number };
export type PerformerPaymentView = {
  id: string;
  eventId: string;
  payeePerformerId: string;
  payee: string;
  amount: number; // the check total = Σ line amounts
  checkNumber: string | null;
  overrideReason: string | null;
  voided: boolean;
  voidReason: string | null;
  replacesPaymentId: string | null;
  lines: PerformerPaymentLineView[];
};

/** Assert the money boundary against the payment's EVENT scope (FR-009), like the gate does. */
async function assertPaymentScope(
  db: Db,
  authz: Actor | undefined,
  eventId: string,
): Promise<void> {
  if (!authz) return;
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) throw errors.eventNotFound();
  assertEventScope(authz, "performer_payment.write", {
    seriesId: event.seriesId,
    groupId: event.groupId,
  });
}

/**
 * Feature 023: bookings must exist, but MAY belong to ANY event — a delayed check written at one event can
 * settle a booking performed at another (cross-event). (Was `assertBookingsForEvent`, which required same
 * event; relaxed in 023, R2.)
 */
async function assertBookingsExist(db: Db, bookingIds: string[]): Promise<void> {
  const rows = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(inArray(bookings.id, bookingIds));
  if (rows.length !== new Set(bookingIds).size) throw errors.bookingNotFound();
}

async function linesFor(db: Db, paymentId: string): Promise<PerformerPaymentLineView[]> {
  const rows = await db
    .select({ bookingId: paymentBookings.bookingId, amountCents: paymentBookings.amountCents })
    .from(paymentBookings)
    .where(eq(paymentBookings.paymentId, paymentId));
  return rows.map((r) => ({ bookingId: r.bookingId, amount: centsToDollars(r.amountCents) }));
}

async function toView(db: Db, row: PerformerPaymentRow): Promise<PerformerPaymentView> {
  const performer = await db.query.performers.findFirst({
    where: eq(performers.id, row.payeePerformerId),
  });
  return {
    id: row.id,
    eventId: row.eventId,
    payeePerformerId: row.payeePerformerId,
    payee: performer?.displayName ?? "(unknown)",
    amount: centsToDollars(row.amountCents),
    checkNumber: row.checkNumber,
    overrideReason: row.overrideReason,
    voided: row.voidedAt !== null,
    voidReason: row.voidReason,
    replacesPaymentId: row.replacesPaymentId,
    lines: await linesFor(db, row.id),
  };
}

export async function createPerformerPayment(
  db: Db,
  input: PerformerPaymentCreateInput,
  actor: string | null = null,
  authz?: Actor,
): Promise<PerformerPaymentView> {
  await assertPaymentScope(db, authz, input.eventId);
  const performer = await db.query.performers.findFirst({
    where: eq(performers.id, input.payeePerformerId),
  });
  if (!performer) throw errors.performerNotFound();
  await assertBookingsExist(
    db,
    input.lines.map((l) => l.bookingId),
  );

  // The check total is the sum of its per-line amounts (integer cents).
  const lineCents = input.lines.map((l) => ({
    bookingId: l.bookingId,
    amountCents: dollarsToCents(l.amount),
  }));
  const totalCents = lineCents.reduce((a, l) => a + l.amountCents, 0);

  const created = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(performerPayments)
      .values({
        eventId: input.eventId,
        payeePerformerId: input.payeePerformerId,
        amountCents: totalCents,
        checkNumber: input.checkNumber ?? null,
        overrideReason: input.overrideReason ?? null,
        replacesPaymentId: input.replacesPaymentId ?? null,
      })
      .returning();
    if (!row) throw new Error("performer payment insert failed");
    await tx.insert(paymentBookings).values(
      lineCents.map((l) => ({
        paymentId: row.id,
        bookingId: l.bookingId,
        amountCents: l.amountCents,
      })),
    );
    return row;
  });
  writeAudit({
    kind: "performer_payment.created",
    actor,
    details: { paymentId: created.id, eventId: input.eventId, lines: lineCents.length },
  });
  return toView(db, created);
}

export async function patchPerformerPayment(
  db: Db,
  id: string,
  input: PerformerPaymentPatchInput,
  actor: string | null = null,
  authz?: Actor,
): Promise<PerformerPaymentView> {
  const current = await db.query.performerPayments.findFirst({
    where: eq(performerPayments.id, id),
  });
  if (!current) throw errors.performerPaymentNotFound();
  await assertPaymentScope(db, authz, current.eventId);
  // A voided check is terminal — correct it with a reissue, never by editing.
  if (current.voidedAt !== null) throw errors.validation("Cannot edit a voided payment.");
  if (input.lines)
    await assertBookingsExist(
      db,
      input.lines.map((l) => l.bookingId),
    );

  const lineCents = input.lines?.map((l) => ({
    bookingId: l.bookingId,
    amountCents: dollarsToCents(l.amount),
  }));

  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(performerPayments)
      .set({
        amountCents: lineCents
          ? lineCents.reduce((a, l) => a + l.amountCents, 0)
          : current.amountCents,
        checkNumber: input.checkNumber !== undefined ? input.checkNumber : current.checkNumber,
        overrideReason:
          input.overrideReason !== undefined ? input.overrideReason : current.overrideReason,
        updatedAt: new Date(),
      })
      .where(eq(performerPayments.id, id))
      .returning();
    if (!row) throw errors.performerPaymentNotFound();
    if (lineCents) {
      await tx.delete(paymentBookings).where(eq(paymentBookings.paymentId, id));
      await tx.insert(paymentBookings).values(
        lineCents.map((l) => ({
          paymentId: id,
          bookingId: l.bookingId,
          amountCents: l.amountCents,
        })),
      );
    }
    return row;
  });
  writeAudit({
    kind: "performer_payment.updated",
    actor,
    details: { paymentId: id, fields: Object.keys(input) },
  });
  return toView(db, updated);
}

/** Feature 023: void a check — it persists (the treasurer records the void) and settles nothing. */
export async function voidPerformerPayment(
  db: Db,
  id: string,
  reason: string,
  actor: string | null = null,
  authz?: Actor,
): Promise<PerformerPaymentView> {
  const current = await db.query.performerPayments.findFirst({
    where: eq(performerPayments.id, id),
  });
  if (!current) throw errors.performerPaymentNotFound();
  await assertPaymentScope(db, authz, current.eventId);
  const [row] = await db
    .update(performerPayments)
    .set({ voidedAt: new Date(), voidReason: reason, updatedAt: new Date() })
    .where(eq(performerPayments.id, id))
    .returning();
  if (!row) throw errors.performerPaymentNotFound();
  writeAudit({ kind: "performer_payment.voided", actor, details: { paymentId: id, reason } });
  return toView(db, row);
}

export async function deletePerformerPayment(
  db: Db,
  id: string,
  actor: string | null = null,
  authz?: Actor,
): Promise<void> {
  const current = await db.query.performerPayments.findFirst({
    where: eq(performerPayments.id, id),
  });
  if (!current) throw errors.performerPaymentNotFound();
  await assertPaymentScope(db, authz, current.eventId);
  await db.delete(performerPayments).where(eq(performerPayments.id, id)); // join rows cascade
  writeAudit({ kind: "performer_payment.deleted", actor, details: { paymentId: id } });
}

/**
 * Feature 023 (analyze M1): the cents actually settled onto each of an event's bookings — the sum of LIVE
 * (non-voided) per-line amounts whose booking belongs to the event. Keyed on the booking's event, so a
 * cross-event check contributes to the event its line settles, not the event it was recorded at.
 */
export async function settledCentsByBookingForEvent(
  db: Db,
  eventId: string,
): Promise<Map<string, number>> {
  const rows = await db
    .select({ bookingId: paymentBookings.bookingId, amountCents: paymentBookings.amountCents })
    .from(paymentBookings)
    .innerJoin(performerPayments, eq(performerPayments.id, paymentBookings.paymentId))
    .innerJoin(bookings, eq(bookings.id, paymentBookings.bookingId))
    .where(and(eq(bookings.eventId, eventId), isNull(performerPayments.voidedAt)));
  const byBooking = new Map<string, number>();
  for (const r of rows)
    byBooking.set(r.bookingId, (byBooking.get(r.bookingId) ?? 0) + r.amountCents);
  return byBooking;
}

/** True if any of the event's bookings is settled by a LIVE payment line (guardrail — FR-013, H1). */
export async function eventHasLiveSettlement(db: Db, eventId: string): Promise<boolean> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(paymentBookings)
    .innerJoin(performerPayments, eq(performerPayments.id, paymentBookings.paymentId))
    .innerJoin(bookings, eq(bookings.id, paymentBookings.bookingId))
    .where(and(eq(bookings.eventId, eventId), isNull(performerPayments.voidedAt)));
  return (row?.n ?? 0) > 0;
}

/** FR-008: actual payments recorded at an event, plus the expected-vs-actual reconciliation for the event. */
export async function listPerformerPayments(
  db: Db,
  eventId: string,
): Promise<{ payments: PerformerPaymentView[]; reconciliation: ReconciliationView }> {
  const paymentRows = await db
    .select()
    .from(performerPayments)
    .where(eq(performerPayments.eventId, eventId));
  const payments = await Promise.all(paymentRows.map((r) => toView(db, r)));

  // Reconciliation (M1): expected = the event's bookings' pay; actual = the LIVE per-line amounts settling
  // THIS event's bookings (regardless of which check paid them, excluding voided).
  const bookingRows = await db
    .select({ id: bookings.id, payCents: bookings.payCents })
    .from(bookings)
    .where(eq(bookings.eventId, eventId));
  const settled = await settledCentsByBookingForEvent(db, eventId);
  const recon: Reconciliation = reconcilePayments(
    bookingRows.map((b) => b.payCents),
    bookingRows.map((b) => settled.get(b.id) ?? 0),
  );
  return {
    payments,
    reconciliation: {
      expected: centsToDollars(recon.expectedCents),
      actual: centsToDollars(recon.actualCents),
      delta: centsToDollars(recon.deltaCents),
    },
  };
}

type ReconciliationView = { expected: number; actual: number; delta: number };
