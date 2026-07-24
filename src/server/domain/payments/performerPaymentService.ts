import { eq, inArray } from "drizzle-orm";
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

export type PerformerPaymentView = {
  id: string;
  eventId: string;
  payeePerformerId: string;
  payee: string;
  amount: number;
  checkNumber: string | null;
  overrideReason: string | null;
  bookingIds: string[];
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

/** All bookings must exist and belong to the given event — settlement is per event (FR-006, US2). */
async function assertBookingsForEvent(
  db: Db,
  eventId: string,
  bookingIds: string[],
): Promise<void> {
  const rows = await db
    .select({ id: bookings.id, eventId: bookings.eventId })
    .from(bookings)
    .where(inArray(bookings.id, bookingIds));
  if (rows.length !== bookingIds.length) throw errors.bookingNotFound();
  if (rows.some((r) => r.eventId !== eventId)) throw errors.bookingEventMismatch();
}

async function linkedBookingIds(db: Db, paymentId: string): Promise<string[]> {
  const rows = await db
    .select({ bookingId: paymentBookings.bookingId })
    .from(paymentBookings)
    .where(eq(paymentBookings.paymentId, paymentId));
  return rows.map((r) => r.bookingId);
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
    bookingIds: await linkedBookingIds(db, row.id),
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
  await assertBookingsForEvent(db, input.eventId, input.bookingIds);

  const created = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(performerPayments)
      .values({
        eventId: input.eventId,
        payeePerformerId: input.payeePerformerId,
        amountCents: dollarsToCents(input.amount),
        checkNumber: input.checkNumber ?? null,
        overrideReason: input.overrideReason ?? null,
      })
      .returning();
    if (!row) throw new Error("performer payment insert failed");
    await tx
      .insert(paymentBookings)
      .values(input.bookingIds.map((bookingId) => ({ paymentId: row.id, bookingId })));
    return row;
  });
  writeAudit({
    kind: "performer_payment.created",
    actor,
    details: { paymentId: created.id, eventId: input.eventId, bookingIds: input.bookingIds },
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
  if (input.bookingIds) await assertBookingsForEvent(db, current.eventId, input.bookingIds);

  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(performerPayments)
      .set({
        amountCents:
          input.amount !== undefined ? dollarsToCents(input.amount) : current.amountCents,
        checkNumber: input.checkNumber !== undefined ? input.checkNumber : current.checkNumber,
        overrideReason:
          input.overrideReason !== undefined ? input.overrideReason : current.overrideReason,
        updatedAt: new Date(),
      })
      .where(eq(performerPayments.id, id))
      .returning();
    if (!row) throw errors.performerPaymentNotFound();
    if (input.bookingIds) {
      await tx.delete(paymentBookings).where(eq(paymentBookings.paymentId, id));
      await tx
        .insert(paymentBookings)
        .values(input.bookingIds.map((bookingId) => ({ paymentId: id, bookingId })));
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

/** FR-008: actual payments for an event, plus the expected-vs-actual reconciliation. */
export async function listPerformerPayments(
  db: Db,
  eventId: string,
): Promise<{ payments: PerformerPaymentView[]; reconciliation: ReconciliationView }> {
  const paymentRows = await db
    .select()
    .from(performerPayments)
    .where(eq(performerPayments.eventId, eventId));
  const payments = await Promise.all(paymentRows.map((r) => toView(db, r)));

  const bookingRows = await db
    .select({ payCents: bookings.payCents })
    .from(bookings)
    .where(eq(bookings.eventId, eventId));
  const recon: Reconciliation = reconcilePayments(
    bookingRows.map((b) => b.payCents),
    paymentRows.map((p) => p.amountCents),
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
