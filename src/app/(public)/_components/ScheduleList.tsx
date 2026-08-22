import Link from "next/link";
import type { PublicScheduleItem } from "@/server/domain/public/publicSchedule";
import styles from "./ScheduleList.module.css";

/**
 * The shared public dance list (feature 037, P6-R4) — used by `/whats-on` and `/what-was-on`. Server
 * component; each row links to the shared `/whats-on/<eventId>` detail page. Renders `emptyMessage` when
 * there are no items. Feature 045 (P7-R1): styled from design tokens via CSS Modules (was inline).
 */
export default function ScheduleList({
  items,
  emptyMessage = "No dances to show.",
}: {
  items: PublicScheduleItem[];
  emptyMessage?: string;
}) {
  if (items.length === 0) {
    return <p className={styles.empty}>{emptyMessage}</p>;
  }
  return (
    <ul className={styles.list}>
      {items.map((s) => (
        <li key={s.eventId} className={styles.row}>
          <Link href={`/whats-on/${s.eventId}`} className={styles.link}>
            <span className={styles.date}>{s.date}</span>
            <span className={styles.meta}>
              {s.startTime ? ` ${s.startTime}` : ""} — {s.activity}
              {s.label ? ` · ${s.label}` : ""}
              {s.venueName ? ` @ ${s.venueName}` : ""}
              {s.advertisedPrice != null ? ` · $${s.advertisedPrice.toFixed(2)}` : ""}
            </span>
            {s.cancelled ? <span className={styles.cancelled}> · CANCELLED</span> : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}
