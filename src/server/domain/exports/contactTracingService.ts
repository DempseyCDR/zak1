import { and, eq, sql } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import { attendance, contactEmails, contacts, events } from "@/server/db/schema";
import { errors } from "@/server/lib/apiError";
import { listEventAttendance } from "@/server/domain/attendance/attendanceService";
import { splitDisplayName } from "./exportService";

export type ContactTracingResult = { count: number; rows: Record<string, string>[] };

/**
 * Contact-tracing export for one event (FR-006). `count` is the raw attendance count — the
 * caller uses it to short-circuit CSV generation when zero (FR-006c); `rows` is the
 * consent-qualified subset (may legitimately be smaller than `count`).
 */
export async function buildContactTracingRows(db: Db, eventId: string): Promise<ContactTracingResult> {
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) throw errors.eventNotFound();

  const { count } = await listEventAttendance(db, eventId);
  if (count === 0) return { count: 0, rows: [] };

  const qualifying = await db
    .select({ email: contactEmails.email, displayName: contacts.displayName })
    .from(attendance)
    .innerJoin(contacts, eq(contacts.id, attendance.contactId))
    .innerJoin(contactEmails, eq(contactEmails.contactId, contacts.id))
    .where(
      and(
        eq(attendance.eventId, eventId),
        eq(contactEmails.status, "active"),
        sql`'contact_tracing'::email_consent_topic = ANY(${contactEmails.consentTopics})`,
      ),
    );

  const rows = qualifying.map((r) => {
    const { firstName, lastName } = splitDisplayName(r.displayName);
    return { email: r.email, first_name: firstName, last_name: lastName, date: event.eventDate };
  });

  return { count, rows };
}
