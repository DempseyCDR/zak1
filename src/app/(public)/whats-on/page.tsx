import Link from "next/link";
import { db } from "@/server/db/client";
import { getPublicSchedule } from "@/server/domain/public/publicSchedule";

// Server Component: reads the public schedule directly (no client bundle, no private data).
export default async function WhatsOnPage() {
  const schedule = await getPublicSchedule(db);

  return (
    <main style={{ padding: 24, maxWidth: 720 }}>
      <h1>What&apos;s on</h1>
      {schedule.length === 0 && <p style={{ color: "#666" }}>No upcoming dances scheduled.</p>}
      <ul style={{ listStyle: "none", padding: 0 }}>
        {schedule.map((s) => (
          <li key={s.eventId} style={{ padding: "8px 0", borderBottom: "1px solid #eee" }}>
            <Link href={`/whats-on/${s.eventId}`} style={{ textDecoration: "none", color: "inherit" }}>
              <strong>{s.date}</strong>
              {s.startTime ? ` ${s.startTime}` : ""} — {s.activity}
              {s.label ? ` · ${s.label}` : ""}
              {s.venueName ? ` @ ${s.venueName}` : ""}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
