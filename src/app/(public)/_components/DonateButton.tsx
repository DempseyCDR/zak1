import styles from "./DonateButton.module.css";

/**
 * Feature 055 (P7-R12): the club's donation affordance — distinct from paying membership dues. Points at the
 * club's PayPal DONATION destination (a hosted button), opened as a safe outbound action. Reused by the footer
 * and the membership page. ⚠️ `PAYPAL_DONATE_URL` is a pre-rollout config value (confirm the production PayPal
 * account/button before going live) — kept as one constant so the swap is trivial.
 */
const PAYPAL_DONATE_URL = "https://www.paypal.com/donate/?hosted_button_id=A26Z8KLA9JUZE";

export default function DonateButton({ className }: { className?: string }) {
  return (
    <a
      className={`${styles.donate}${className ? ` ${className}` : ""}`}
      href={PAYPAL_DONATE_URL}
      target="_blank"
      rel="noopener noreferrer"
    >
      Donate
    </a>
  );
}
