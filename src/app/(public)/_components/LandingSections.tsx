import type { StyleLanding } from "@/app/(public)/dances/landingContent";
import styles from "./LandingSections.module.css";

/**
 * Feature 050 (P7-R6): the migrated prose for a style landing page — what it is, why you'll love it, and what
 * to expect — as `<h2>`-headed sections. Pure (takes one `StyleLanding`); the page owns the single `<h1>`, so
 * this renders none. The copy is the club's own voice (see `landingContent.ts`), rendered verbatim.
 */
export default function LandingSections({ content }: { content: StyleLanding }) {
  return (
    <>
      <section className={styles.section}>
        <h2 className={styles.heading}>What it is</h2>
        {content.intro.map((p, i) => (
          <p key={i} className={styles.para}>
            {p}
          </p>
        ))}
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>Why you&apos;ll love it</h2>
        {content.whyYoullLove.map((p, i) => (
          <p key={i} className={styles.para}>
            {p}
          </p>
        ))}
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>What to expect</h2>
        <ul className={styles.list}>
          {content.whatToExpect.map((item, i) => (
            <li key={i} className={styles.item}>
              {item}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
