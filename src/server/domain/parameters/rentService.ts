import { and, desc, eq, isNull, lte } from "drizzle-orm";
import type { Db, DbOrTx } from "@/server/db/client";
import { series, venueRentAudit, venueRents, venues } from "@/server/db/schema";
import type { VenueRentRow } from "@/server/db/schema";
import { errors } from "@/server/lib/apiError";
import { writeAudit } from "@/server/lib/audit";
import { dollarsToCents } from "@/server/lib/money";
import type { VenueRentCreateInput } from "@/server/validation/venueRents";

type EventRentInput = {
  rentCents: number | null;
  venueId: string | null;
  seriesId: string;
  eventDate: string;
};

async function latestVenueRent(
  db: DbOrTx,
  venueId: string,
  seriesId: string | null,
  onDate: string,
): Promise<number | null> {
  const [row] = await db
    .select({ amountCents: venueRents.amountCents })
    .from(venueRents)
    .where(
      and(
        eq(venueRents.venueId, venueId),
        seriesId === null ? isNull(venueRents.seriesId) : eq(venueRents.seriesId, seriesId),
        lte(venueRents.effectiveDate, onDate),
      ),
    )
    .orderBy(desc(venueRents.effectiveDate))
    .limit(1);
  return row?.amountCents ?? null;
}

/**
 * Resolve an event's rent (cents), most specific first (FR-005):
 * per-event override → series-at-venue → venue default → 0.
 */
export async function resolveEventRentCents(db: DbOrTx, event: EventRentInput): Promise<number> {
  if (event.rentCents != null) return event.rentCents;
  if (!event.venueId) return 0;
  const seriesAtVenue = await latestVenueRent(db, event.venueId, event.seriesId, event.eventDate);
  if (seriesAtVenue != null) return seriesAtVenue;
  const venueDefault = await latestVenueRent(db, event.venueId, null, event.eventDate);
  return venueDefault ?? 0;
}

/** Create a venue rent (venue default when seriesKey omitted; else series-at-venue). */
export async function createVenueRent(
  db: Db,
  input: VenueRentCreateInput,
  actor: string | null = null,
): Promise<VenueRentRow> {
  const venue = await db.query.venues.findFirst({ where: eq(venues.id, input.venueId) });
  if (!venue) throw errors.venueNotFound();
  let seriesId: string | null = null;
  if (input.seriesKey) {
    const s = await db.query.series.findFirst({ where: eq(series.key, input.seriesKey) });
    if (!s) throw errors.seriesNotFound();
    seriesId = s.id;
  }
  const amountCents = dollarsToCents(input.amount);
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(venueRents)
      .values({ venueId: input.venueId, seriesId, amountCents, effectiveDate: input.effectiveDate })
      .returning();
    if (!row) throw new Error("venue rent insert failed");
    await tx.insert(venueRentAudit).values({
      venueId: input.venueId,
      seriesId,
      amountCents,
      effectiveDate: input.effectiveDate,
      actor,
    });
    writeAudit({
      kind: "venue_rent.created",
      actor,
      details: { venueId: input.venueId, seriesId, amountCents },
    });
    return row;
  });
}
