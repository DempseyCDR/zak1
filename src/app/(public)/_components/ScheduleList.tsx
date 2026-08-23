import type { PublicScheduleItem } from "@/server/domain/public/publicSchedule";
import EventCard from "./EventCard";
import styles from "./ScheduleList.module.css";

/**
 * The shared public dance list (feature 037, P6-R4) — used by `/whats-on`, `/what-was-on`, and the P7-R3
 * home "Coming up" strip. Server component; renders `emptyMessage` when there are no items. Feature 048
 * (P7-R4): each item is now an `EventCard` (was a text row), so the card restyle lands on all three
 * surfaces at once. Each card links to the shared `/whats-on/<eventId>` detail page.
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
        <li key={s.eventId} className={styles.item}>
          <EventCard item={s} />
        </li>
      ))}
    </ul>
  );
}
