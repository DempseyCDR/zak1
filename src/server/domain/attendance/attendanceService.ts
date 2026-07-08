import { and, eq, sql } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import { attendance, contactEmails, contacts, events } from "@/server/db/schema";
import type { AttendanceRow } from "@/server/db/schema";
import { errors } from "@/server/lib/apiError";
import { deriveContactNames } from "@/server/domain/contacts/normalize";
import type { AttendanceInput } from "@/server/validation/attendance";

const UNIQUE_VIOLATION = "23505";

/**
 * Record attendance against an event (not a door record). Three paths: existing
 * contact, new door-created contact (flagged needs_review), or unmatched.
 */
export async function recordAttendance(
  db: Db,
  eventId: string,
  input: AttendanceInput,
): Promise<AttendanceRow> {
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) throw errors.eventNotFound();

  let contactId: string | null = null;

  if ("contactId" in input) {
    contactId = input.contactId;
    const dup = await db.query.attendance.findFirst({
      where: and(eq(attendance.eventId, eventId), eq(attendance.contactId, contactId)),
    });
    if (dup) throw errors.alreadyCheckedIn();
  } else if ("newContact" in input) {
    const names = deriveContactNames({
      firstName: input.newContact.firstName,
      lastName: input.newContact.lastName ?? null,
    });
    const [created] = await db
      .insert(contacts)
      .values({
        firstName: input.newContact.firstName,
        lastName: input.newContact.lastName ?? null,
        displayName: names.displayName,
        nameNormalized: names.nameNormalized,
        dedupNormalized: names.dedupNormalized,
        phone: input.newContact.phone ?? null,
        needsReview: true,
        source: "door",
      })
      .returning();
    if (!created) throw new Error("contact insert failed");
    contactId = created.id;
    // Capture the door-entered email best-effort; a duplicate (already in the
    // directory) is left for admin review rather than blocking check-in.
    if (input.newContact.email) {
      try {
        await db
          .insert(contactEmails)
          .values({ contactId: created.id, email: input.newContact.email });
      } catch (err) {
        if (!(typeof err === "object" && err && (err as { code?: string }).code === UNIQUE_VIOLATION)) {
          throw err;
        }
      }
    }
  }
  // else unmatched → contactId stays null

  const [row] = await db.insert(attendance).values({ eventId, contactId }).returning();
  if (!row) throw new Error("attendance insert failed");
  // Persisted per-event count for the organizer report; survives the 90-day purge.
  await db
    .update(events)
    .set({ attendanceCount: sql`${events.attendanceCount} + 1` })
    .where(eq(events.id, eventId));
  return row;
}

export type AttendeeView = {
  id: string;
  contactId: string | null;
  displayName: string | null; // null for unmatched placeholders
  createdAt: string;
};

export type EventAttendanceView = {
  count: number;
  attendees: AttendeeView[];
};

/**
 * The contact-tracing attendee list for an event (FR-001b): matched contacts
 * with their display name plus unmatched placeholders. After the 90-day purge
 * (FR-011) there are no attendance rows, so this returns count 0 / empty list.
 */
export async function listEventAttendance(
  db: Db,
  eventId: string,
): Promise<EventAttendanceView> {
  const rows = await db
    .select({
      id: attendance.id,
      contactId: attendance.contactId,
      displayName: contacts.displayName,
      createdAt: attendance.createdAt,
    })
    .from(attendance)
    .leftJoin(contacts, eq(contacts.id, attendance.contactId))
    .where(eq(attendance.eventId, eventId));

  const attendees: AttendeeView[] = rows.map((r) => ({
    id: r.id,
    contactId: r.contactId,
    displayName: r.displayName ?? null,
    createdAt: r.createdAt.toISOString(),
  }));
  return { count: attendees.length, attendees };
}
