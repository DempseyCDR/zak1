import { and, eq, sql } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import {
  attendance,
  bookings,
  contactEmails,
  contacts,
  doorRecords,
  events,
  performers,
  series,
} from "@/server/db/schema";
import type { AttendanceRow } from "@/server/db/schema";
import { errors } from "@/server/lib/apiError";
import { deriveContactNames } from "@/server/domain/contacts/normalize";
import { ensureDoorRecord } from "@/server/domain/door/doorRecordService";
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

  // B36: an open-band musician is flagged manually at check-in (never sourced from bookings).
  const isOpenBand = "isOpenBand" in input ? (input.isOpenBand ?? false) : false;
  if (isOpenBand) {
    // FR-022: the open-band rule is the community_dance series' own; reject it elsewhere.
    const evtSeries = await db.query.series.findFirst({ where: eq(series.id, event.seriesId) });
    if (evtSeries?.key !== "community_dance") {
      throw errors.validation("Open-band musicians can only be checked in at a community dance.");
    }
  }

  let contactId: string | null = null;

  if ("contactId" in input) {
    contactId = input.contactId;
    const dup = await db.query.attendance.findFirst({
      where: and(eq(attendance.eventId, eventId), eq(attendance.contactId, contactId)),
    });
    if (dup) throw errors.alreadyCheckedIn();
    // FR-022a: a booked performer is already counted in the performer subtraction; flagging them as an
    // unpaid open-band comp too would double-subtract from paying dancers.
    if (isOpenBand) {
      const booked = await db
        .select({ id: bookings.id })
        .from(bookings)
        .innerJoin(performers, eq(performers.id, bookings.performerId))
        .where(and(eq(bookings.eventId, eventId), eq(performers.contactId, contactId)))
        .limit(1);
      if (booked.length > 0) {
        throw errors.validation(
          "A booked performer cannot also be checked in as an open-band musician.",
        );
      }
    }
  } else if ("newContact" in input) {
    const names = deriveContactNames({
      firstName: input.newContact.firstName,
      lastName: input.newContact.lastName ?? null,
      displayNameOverride: input.newContact.displayNameOverride ?? null,
    });
    const [created] = await db
      .insert(contacts)
      .values({
        firstName: input.newContact.firstName,
        lastName: input.newContact.lastName ?? null,
        displayNameOverride: input.newContact.displayNameOverride ?? null,
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
        if (
          !(typeof err === "object" && err && (err as { code?: string }).code === UNIQUE_VIOLATION)
        ) {
          throw err;
        }
      }
    }
  }
  // else unmatched → contactId stays null

  // B35: a family checks in as the parent's row plus a children count; children are paying, so they
  // ride inside events.attendance_count (the persisted source for the report — no formula change).
  const childrenCount = "childrenCount" in input ? (input.childrenCount ?? 0) : 0;

  const [row] = await db
    .insert(attendance)
    .values({ eventId, contactId, childrenCount, isOpenBand })
    .returning();
  if (!row) throw new Error("attendance insert failed");
  // Persisted per-event count for the organizer report; survives the 90-day purge.
  await db
    .update(events)
    .set({ attendanceCount: sql`${events.attendanceCount} + ${1 + childrenCount}` })
    .where(eq(events.id, eventId));
  // B36: an open-band musician is comped. The comp is a PERSISTED count on the door record
  // (open_band_count) — separate from comp_count and surviving the 90-day purge — so the report reads
  // it as effective comps = comp_count + open_band_count.
  if (isOpenBand) {
    const dr = await ensureDoorRecord(db, eventId, "door");
    await db
      .update(doorRecords)
      .set({ openBandCount: sql`${doorRecords.openBandCount} + 1`, updatedAt: new Date() })
      .where(eq(doorRecords.id, dr.id));
  }
  return row;
}

export type AttendeeView = {
  id: string;
  contactId: string | null;
  firstName: string | null; // null for unmatched placeholders
  lastName: string | null;
  displayName: string | null; // null for unmatched placeholders
  childrenCount: number; // B35: children on this check-in
  isOpenBand: boolean; // B36: open-band musician marker
  createdAt: string;
};

export type EventAttendanceView = {
  count: number;
  attendees: AttendeeView[];
};

/** Roster sort field (B33): by first or by last name; the other name is the tiebreak. */
export type RosterSort = "first" | "last";

/**
 * The checked-in attendee list for an event. Serves both contact-tracing (FR-001b — count + display
 * name) and the Door Attendant roster (B33 — structured first/last names, sortable). Ordered by the
 * requested name field (default last), the other name as tiebreak, unmatched placeholders last. After
 * the 90-day purge there are no attendance rows, so this returns count 0 / empty list.
 */
export async function listEventAttendance(
  db: Db,
  eventId: string,
  sort: RosterSort = "last",
): Promise<EventAttendanceView> {
  const orderBy =
    sort === "first"
      ? sql`lower(${contacts.firstName}) asc nulls last, lower(${contacts.lastName}) asc nulls last, ${attendance.createdAt} asc`
      : sql`lower(${contacts.lastName}) asc nulls last, lower(${contacts.firstName}) asc nulls last, ${attendance.createdAt} asc`;

  const rows = await db
    .select({
      id: attendance.id,
      contactId: attendance.contactId,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
      displayName: contacts.displayName,
      childrenCount: attendance.childrenCount,
      isOpenBand: attendance.isOpenBand,
      createdAt: attendance.createdAt,
    })
    .from(attendance)
    .leftJoin(contacts, eq(contacts.id, attendance.contactId))
    .where(eq(attendance.eventId, eventId))
    .orderBy(orderBy);

  const attendees: AttendeeView[] = rows.map((r) => ({
    id: r.id,
    contactId: r.contactId,
    firstName: r.firstName ?? null,
    lastName: r.lastName ?? null,
    displayName: r.displayName ?? null,
    childrenCount: r.childrenCount,
    isOpenBand: r.isOpenBand,
    createdAt: r.createdAt.toISOString(),
  }));
  return { count: attendees.length, attendees };
}
