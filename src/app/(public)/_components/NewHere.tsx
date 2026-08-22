import Link from "next/link";
import styles from "./NewHere.module.css";

/**
 * Feature 047 (P7-R3, US1): the "new here?" orientation block — orients a first-time visitor (what the
 * dancing is, all welcome, no partner needed, cost) and leads onward to the schedule. Pure/presentational
 * (jsdom-tested). Copy is the club's voice; refine wording with the club as needed.
 */
export default function NewHere() {
  return (
    <section className={styles.newHere} aria-labelledby="new-here-heading">
      <h2 id="new-here-heading">New to dancing?</h2>
      <p>
        <strong>All are welcome</strong> — no experience and <strong>no partner needed</strong>. If
        you can walk, you can dance. Contra and English country dancing are lively, social, and
        friendly; every dance is taught and gently called from the stage, so you&rsquo;re never on
        your own.
      </p>
      <p>
        Just come as you are — comfortable clothes and flat, soft-soled shoes. Admission is
        affordable and paid at the door; each dance lists its price on the schedule.
      </p>
      <p>
        <Link href="/whats-on" className={styles.cta}>
          See upcoming dances &rarr;
        </Link>
      </p>
    </section>
  );
}
