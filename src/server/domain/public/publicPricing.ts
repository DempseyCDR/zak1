import type { DbOrTx } from "@/server/db/client";
import { centsToDollars } from "@/server/lib/money";
import {
  resolveAdmissionTiers,
  type AdmissionTier,
} from "@/server/domain/pricing/admissionPricingService";

// Feature 054 (P7-R10): the single public pricing value every surface renders. `resolveEventPricing` is the
// one resolution point; the card summary is DERIVED from the same value, so a card and the detail page can
// never disagree (the single-source invariant). Amounts are dollars.

export type PublicPricing =
  | { kind: "flat"; amount: number }
  | { kind: "tiers"; tiers: { label: string; amount: number }[] }
  | null;

/**
 * Pure derivation. A non-null per-event override → a flat price (a special). Otherwise the series tiers →
 * `{ tiers }` when non-empty (even if every tier is $0 — a configured-free series stays non-null, distinct
 * from unconfigured). No override and no tiers → `null` (no price shown). Cents → dollars.
 */
export function pricingFromTiers(
  tiers: AdmissionTier[],
  advertisedPriceCents: number | null,
): PublicPricing {
  if (advertisedPriceCents !== null) {
    return { kind: "flat", amount: centsToDollars(advertisedPriceCents) };
  }
  if (tiers.length === 0) return null;
  return {
    kind: "tiers",
    tiers: tiers.map((t) => ({ label: t.label, amount: centsToDollars(t.amountCents) })),
  };
}

/**
 * The concise card label, derived from `PublicPricing`. Flat → "$12" (or "Free" at $0). Tiers → a range over
 * the DISTINCT NON-ZERO amounts ("$5–$15"; a single non-zero → "$12"); a non-empty tier set that is all $0 →
 * "Free" (configured-free, never blank). `null` → `null` (no price shown).
 */
export function pricingSummary(p: PublicPricing): string | null {
  if (p === null) return null;
  if (p.kind === "flat") return p.amount === 0 ? "Free" : money(p.amount);
  const nonZero = [...new Set(p.tiers.map((t) => t.amount).filter((a) => a > 0))].sort(
    (a, b) => a - b,
  );
  if (nonZero.length === 0) return "Free"; // configured, but every tier is $0
  if (nonZero.length === 1) return money(nonZero[0]!);
  return `${money(nonZero[0]!)}–${money(nonZero[nonZero.length - 1]!)}`;
}

function money(amount: number): string {
  return `$${Number.isInteger(amount) ? amount : amount.toFixed(2)}`;
}

/**
 * Resolve the pricing that applies to an event: the flat override if set, else the series' tiers effective on
 * the event date, else null. The one DB-backed entry point for public price reads.
 */
export async function resolveEventPricing(
  db: DbOrTx,
  input: { seriesId: string; eventDate: string; advertisedPriceCents: number | null },
): Promise<PublicPricing> {
  if (input.advertisedPriceCents !== null) {
    return pricingFromTiers([], input.advertisedPriceCents);
  }
  const tiers = await resolveAdmissionTiers(db, input.seriesId, input.eventDate);
  return pricingFromTiers(tiers, null);
}
