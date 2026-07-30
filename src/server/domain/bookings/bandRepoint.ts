import { and, eq } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import { bands, bookings, events } from "@/server/db/schema";
import { errors } from "@/server/lib/apiError";
import { assertEventScope } from "@/server/auth/can";
import type { Actor } from "@/server/auth/actor";
import { writeAudit } from "@/server/lib/audit";
import { bookBand, type BookBandResult } from "@/server/domain/bands/bookBand";
import { bookingHasLivePayment } from "@/server/domain/payments/performerPaymentService";

export type RepointBandResult = {
  removed: number; // outgoing (unpaid) bookings removed
  keptNoShow: number; // outgoing bookings settled by a live check, kept as declined no-shows
  booked: BookBandResult; // the incoming band, booked fresh
};

/**
 * Feature 024 US2 (FR-003 + FR-005): re-point an event's band to a different one. For each of the event's
 * `fromBandId` bookings: **remove** it if unpaid, or **keep** it as a `declined` no-show if it is settled by
 * a live check (the written-check discriminator — never orphan a payment line). Then book `toBandId`'s
 * current roster **fresh** (proposed, standard rates, lead as `lead_musician`) via the existing `bookBand`
 * path — no reconciliation of members the two bands share. Acts **only** on `fromBandId`; other bands and
 * non-band bookings on the event are untouched (analyze L1). The no-show decline is a **direct** update (not
 * `patchBooking`), so it never triggers the lead cascade (analyze H1). One transaction, audited.
 */
export async function repointBand(
  db: Db,
  eventId: string,
  fromBandId: string,
  toBandId: string,
  actor: string | null = null,
  authz?: Actor,
): Promise<RepointBandResult> {
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) throw errors.eventNotFound();
  assertEventScope(authz, "booking.write", { seriesId: event.seriesId, groupId: event.groupId });
  const from = await db.query.bands.findFirst({ where: eq(bands.id, fromBandId) });
  if (!from) throw errors.bandNotFound();
  const to = await db.query.bands.findFirst({ where: eq(bands.id, toBandId) });
  if (!to) throw errors.bandNotFound();

  const result = await db.transaction(async (tx) => {
    const outgoing = await tx
      .select({ id: bookings.id })
      .from(bookings)
      .where(and(eq(bookings.eventId, eventId), eq(bookings.bandId, fromBandId)));

    let removed = 0;
    let keptNoShow = 0;
    for (const b of outgoing) {
      if (await bookingHasLivePayment(tx, b.id)) {
        await tx
          .update(bookings)
          .set({ status: "declined", updatedAt: new Date() })
          .where(eq(bookings.id, b.id));
        keptNoShow++;
      } else {
        await tx.delete(bookings).where(eq(bookings.id, b.id));
        removed++;
      }
    }

    const booked = await bookBand(tx, eventId, toBandId, [], actor, authz);
    return { removed, keptNoShow, booked };
  });

  writeAudit({
    kind: "band.updated",
    actor,
    details: {
      eventId,
      repointedFrom: fromBandId,
      repointedTo: toBandId,
      removed: result.removed,
      keptNoShow: result.keptNoShow,
      bookedCount: result.booked.createdCount,
    },
  });
  return result;
}
