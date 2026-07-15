import { and, eq } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import { bands, bookings, events } from "@/server/db/schema";
import type { BookingRow } from "@/server/db/schema";
import { errors } from "@/server/lib/apiError";
import { writeAudit } from "@/server/lib/audit";
import { createBooking } from "@/server/domain/bookings/bookingService";
import { getRoster } from "./bandService";

export type BookBandResult = { createdCount: number; skippedCount: number; bookings: BookingRow[] };

/**
 * Book a whole band onto an event: one booking per current roster member, skipping any member
 * already booked on the event (FR-003c). The lead is booked as `lead_musician`, the rest as
 * `musician`; per-member pay follows the existing createBooking chain (override → series musician
 * rate → 0). Each created booking is linked to the band. All in one transaction.
 */
export async function bookBand(
  db: Db,
  eventId: string,
  bandId: string,
  memberPay: { performerId: string; amount: number }[] = [],
  actor: string | null = null,
): Promise<BookBandResult> {
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) throw errors.eventNotFound();
  const band = await db.query.bands.findFirst({ where: eq(bands.id, bandId) });
  if (!band) throw errors.bandNotFound();

  const roster = await getRoster(db, bandId);
  const payByPerformer = new Map(memberPay.map((m) => [m.performerId, m.amount]));

  const result = await db.transaction(async (tx) => {
    const created: BookingRow[] = [];
    let skipped = 0;
    for (const member of roster) {
      const existing = await tx
        .select({ id: bookings.id })
        .from(bookings)
        .where(and(eq(bookings.eventId, eventId), eq(bookings.performerId, member.performerId)))
        .limit(1);
      if (existing.length > 0) {
        skipped++;
        continue;
      }
      const pay = payByPerformer.get(member.performerId);
      const row = await createBooking(
        tx,
        eventId,
        {
          performerId: member.performerId,
          performerType: member.isLead ? "lead_musician" : "musician",
          ...(pay !== undefined ? { pay } : {}),
        },
        actor,
        bandId,
      );
      created.push(row);
    }
    return { created, skipped };
  });

  writeAudit({
    kind: "band.booked",
    actor,
    details: { bandId, eventId, createdCount: result.created.length, skippedCount: result.skipped },
  });
  return {
    createdCount: result.created.length,
    skippedCount: result.skipped,
    bookings: result.created,
  };
}
