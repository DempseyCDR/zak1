import styles from "./MembershipTiers.module.css";

/**
 * Feature 055 (P7-R12): the membership tiers + year window + coverage-through date, presented on /join. The
 * tier amounts are page content (single place here); the `yearLabel` and `coverageThrough` come from the club
 * setting via the shared calc, passed in by the server page so this stays a pure, testable component.
 */

const TIERS: { label: string; amount: string }[] = [
  { label: "Supporter", amount: "$50+" },
  { label: "Family", amount: "$30" },
  { label: "Individual", amount: "$20" },
  { label: "Student", amount: "$10" },
];

export default function MembershipTiers({
  yearLabel,
  coverageThrough,
}: {
  yearLabel: string;
  coverageThrough: string;
}) {
  return (
    <section className={styles.tiers}>
      <p className={styles.year}>
        Membership year: <strong>{yearLabel}</strong>
      </p>
      <ul className={styles.list}>
        {TIERS.map((t) => (
          <li key={t.label} className={styles.tier}>
            <span className={styles.tierLabel}>{t.label}</span>
            <span className={styles.tierAmount}>{t.amount}</span>
          </li>
        ))}
      </ul>
      <p className={styles.coverage}>
        Join today and your membership is active through <strong>{coverageThrough}</strong>.
      </p>
    </section>
  );
}
