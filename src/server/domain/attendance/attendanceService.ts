import { and, eq } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import { attendance, contactEmails, contacts, events } from "@/server/db/schema";
import type { AttendanceRow } from "@/server/db/schema";
import { errors } from "@/server/lib/apiError";
import { normalizeName } from "@/server/domain/contacts/normalize";
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
    const [created] = await db
      .insert(contacts)
      .values({
        displayName: input.newContact.displayName,
        nameNormalized: normalizeName(input.newContact.displayName),
        needsReview: true,
        source: "door",
      })
      .returning();
    if (!created) throw new Error("contact insert failed");
    contactId = created.id;
    // Capture the door-entered email best-effort; a duplicate (already in the
    // directory) is left for admin review rather than blocking check-in.
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
  // else unmatched → contactId stays null

  const [row] = await db.insert(attendance).values({ eventId, contactId }).returning();
  if (!row) throw new Error("attendance insert failed");
  return row;
}

export async function countAttendance(db: Db, eventId: string): Promise<number> {
  const rows = await db.select().from(attendance).where(eq(attendance.eventId, eventId));
  return rows.length;
}
