import Link from "next/link";
import DonateButton from "./DonateButton";
import styles from "./Footer.module.css";

/**
 * Feature 047 (P7-R3, US3): the site-wide public footer. Rendered by the (public) layout, so it appears on
 * every public page and never on admin/door. A semantic <footer> (contentinfo landmark) with club
 * identity, key links, and a support/donate affordance. Pure/presentational (jsdom-tested).
 */
export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <p className={styles.identity}>Country Dancers of Rochester</p>
        {/* Feature 055 (P7-R12): Contact Us (board officers + role aliases, merged) + Donate live in the
            footer, not the top nav. */}
        <nav aria-label="Footer" className={styles.links}>
          <Link href="/whats-on">What&apos;s On</Link>
          <Link href="/join">Join</Link>
          <Link href="/contact-us">Contact Us</Link>
          {/* Feature 058 (P7-R15): the print-friendly schedule. */}
          <Link href="/printable-calendar">Printable calendar</Link>
        </nav>
        <DonateButton className={styles.support} />
        <p className={styles.fine}>&copy; {year} Country Dancers of Rochester</p>
      </div>
    </footer>
  );
}
