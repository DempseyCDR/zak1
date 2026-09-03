import { eq, sql } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import { events } from "@/server/db/schema";
import { errors } from "@/server/lib/apiError";
import { listEventAttendance } from "@/server/domain/attendance/attendanceService";
import { resolvedRecipients } from "./recipients";

export type ContactTracingResult = { count: number; rows: Record<string, string>[] };

/**
 * Contact-tracing export for one event (FR-006). `count` is the raw attendance count — the
 * caller uses it to short-circuit CSV generation when zero (FR-006c); `rows` is the
 * consent-qualified subset (may legitimately be smaller than `count`).
 */
export async function buildContactTracingRows(
  db: Db,
  eventId: string,
): Promise<ContactTracingResult> {
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) throw errors.eventNotFound();

  const { count } = await listEventAttendance(db, eventId);
  if (count === 0) return { count: 0, rows: [] };

  // Feature 067: contact tracing is NOT one of the six mailing lists — it is attendance-driven. Because
  // attendance is a CONTACT-row property, an attending referrer legitimately pulls the household address
  // in (FR-010a); the owner's `contact_tracing` consent still gates it, and DISTINCT ON reaches the
  // household exactly once under the owner's name (FR-010). This is the motivating case for the whole
  // feature: a family gives one address for tracing.
  const qualifying = await db.execute<{
    address: string;
    owner_first_name: string;
    owner_last_name: string | null;
  }>(sql`
    WITH ${resolvedRecipients}
    SELECT DISTINCT ON (r.address) r.address, r.owner_first_name, r.owner_last_name
      FROM attendance a
      JOIN resolved_recipients r ON r.contact_id = a.contact_id
     WHERE a.event_id = ${eventId}
       AND 'contact_tracing'::email_consent_topic = ANY(r.consent_topics)
     ORDER BY r.address, (r.contact_id = r.owner_contact_id) DESC
  `);

  const rows = [...qualifying].map((r) => ({
    email: r.address,
    first_name: r.owner_first_name,
    last_name: r.owner_last_name ?? "",
    date: event.eventDate,
  }));

  return { count, rows };
}
