import type { CSSProperties } from "react";
import Link from "next/link";
import type { PublicScheduleItem } from "@/server/domain/public/publicSchedule";
import { pricingSummary } from "@/server/domain/public/publicPricing";
import { seriesColorVar } from "./seriesColor";
import styles from "./EventCard.module.css";

/**
 * Feature 048 (P7-R4): one tappable event card. Pure — takes a single `PublicScheduleItem`. The **whole
 * card** is a link to the shared `/whats-on/<eventId>` detail page (tap anywhere; ≥44px). It shows a
 * prominent date, the start time, the venue **short** name (falling back to the full name, omitting the
 * line when neither is set), and the advertised price (omitted when null), plus a cancelled marker.
 *
 * The series color is a **left accent stripe** driven by the `--card-accent` CSS variable (set per card
 * from `seriesColorVar`), used only as an accent — never behind normal text — so WCAG AA holds regardless
 * of the series color. Renders no `<h1>`: the page owns the single heading.
 */
export default function EventCard({ item }: { item: PublicScheduleItem }) {
  const venue = item.venueShortName ?? item.venueName;
  const priceSummary = pricingSummary(item.pricing); // feature 054 (P7-R10): derived from the single source
  const accent = { "--card-accent": seriesColorVar(item.seriesKey) } as CSSProperties;
  return (
    <Link href={`/whats-on/${item.eventId}`} className={styles.card} style={accent}>
      <span className={styles.date}>{item.date}</span>
      <span className={styles.details}>
        {item.startTime ? <span className={styles.time}>{item.startTime}</span> : null}
        <span className={styles.activity}>{item.activity}</span>
        {item.label ? <span className={styles.label}>{item.label}</span> : null}
        {venue ? <span className={styles.venue}>{venue}</span> : null}
        {priceSummary != null ? <span className={styles.price}>{priceSummary}</span> : null}
      </span>
      {item.cancelled ? <span className={styles.cancelled}>Cancelled</span> : null}
    </Link>
  );
}
