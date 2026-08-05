import Link from "next/link";
import type { PublicScheduleItem } from "@/server/domain/public/publicSchedule";

/**
 * The shared public dance list (feature 037, P6-R4) — used by `/whats-on` and `/what-was-on`. Server
 * component; each row links to the shared `/whats-on/<eventId>` detail page. Renders `emptyMessage` when
 * there are no items.
 */
export default function ScheduleList({
  items,
  emptyMessage = "No dances to show.",
}: {
  items: PublicScheduleItem[];
  emptyMessage?: string;
}) {
  if (items.length === 0) {
    return <p style={{ color: "#666" }}>{emptyMessage}</p>;
  }
  return (
    <ul style={{ listStyle: "none", padding: 0 }}>
      {items.map((s) => (
        <li key={s.eventId} style={{ padding: "8px 0", borderBottom: "1px solid #eee" }}>
          <Link
            href={`/whats-on/${s.eventId}`}
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <strong>{s.date}</strong>
            {s.startTime ? ` ${s.startTime}` : ""} — {s.activity}
            {s.label ? ` · ${s.label}` : ""}
            {s.venueName ? ` @ ${s.venueName}` : ""}
            {s.advertisedPrice != null ? ` · $${s.advertisedPrice.toFixed(2)}` : ""}
            {s.cancelled ? " · CANCELLED" : ""}
          </Link>
        </li>
      ))}
    </ul>
  );
}
