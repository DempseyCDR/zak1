import { and, desc, eq, lte } from "drizzle-orm";
import type { DbOrTx } from "@/server/db/client";
import { rateParameters } from "@/server/db/schema";
import type { RateKind } from "@/server/db/schema";

/**
 * Resolve the standard rate (in cents) for a kind on a given event date: the
 * row with the greatest effective_date ≤ eventDate. Returns 0 when no rate is
 * configured (organizer can override).
 */
export async function resolveRateCents(
  db: DbOrTx,
  kind: RateKind,
  eventDate: string,
): Promise<number> {
  const [row] = await db
    .select({ amountCents: rateParameters.amountCents })
    .from(rateParameters)
    .where(and(eq(rateParameters.kind, kind), lte(rateParameters.effectiveDate, eventDate)))
    .orderBy(desc(rateParameters.effectiveDate))
    .limit(1);
  return row?.amountCents ?? 0;
}
