import type { PublicPricing } from "@/server/domain/public/publicPricing";
import styles from "./PricingBlock.module.css";

/**
 * Feature 054 (P7-R10): the full admission pricing on the event detail page and the series landing. Renders a
 * `PublicPricing` — tiers as a labelled list (a `$0` tier reads "Free"), a flat special as one price, and
 * NOTHING for `null` (no price configured / not shown). The card renders `pricingSummary` of the same value.
 */
function money(amount: number): string {
  if (amount === 0) return "Free";
  return `$${Number.isInteger(amount) ? amount : amount.toFixed(2)}`;
}

export default function PricingBlock({ pricing }: { pricing: PublicPricing }) {
  if (pricing === null) return null;
  return (
    <section className={styles.pricing}>
      <h2 className={styles.heading}>Admission</h2>
      {pricing.kind === "flat" ? (
        <p className={styles.flat}>{money(pricing.amount)}</p>
      ) : (
        <ul className={styles.tiers}>
          {pricing.tiers.map((t, i) => (
            <li key={`${t.label}-${i}`} className={styles.tier}>
              <span className={styles.tierLabel}>{t.label}</span>
              <span className={styles.tierAmount}>{money(t.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
