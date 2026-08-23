import type { CSSProperties } from "react";
import Image from "next/image";
import { seriesColorVar } from "./seriesColor";
import { seriesHeroSrc } from "./seriesHero";
import styles from "./EventHero.module.css";

/**
 * Feature 049 (P7-R5): the event page's hero. When the event's series has a committed image
 * (`seriesHeroSrc`), render it full-bleed via `next/image`; otherwise render a clean, series-colored header
 * band (no broken image). The series color is an **accent** (`--series-accent`, from the R4 map) — never
 * behind normal text — so WCAG AA holds. Renders no `<h1>`: the page owns the single heading.
 */
export default function EventHero({
  seriesKey,
  activity,
}: {
  seriesKey: string;
  activity: string;
}) {
  const src = seriesHeroSrc(seriesKey);
  const accent = { "--series-accent": seriesColorVar(seriesKey) } as CSSProperties;

  if (!src) {
    return <div className={styles.plain} style={accent} aria-hidden="true" />;
  }
  return (
    <div className={styles.hero} style={accent}>
      <Image src={src} alt={activity} fill priority sizes="100vw" className={styles.image} />
    </div>
  );
}
