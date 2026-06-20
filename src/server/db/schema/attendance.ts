import { integer, pgTable, smallint, timestamp, uuid, unique } from "drizzle-orm/pg-core";
import { contacts } from "./contacts";
import { events, series } from "./events";

export const attendance = pgTable("attendance", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const quarterlyAttendanceCounts = pgTable(
  "quarterly_attendance_counts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    seriesId: uuid("series_id")
      .notNull()
      .references(() => series.id),
    year: integer("year").notNull(),
    quarter: smallint("quarter").notNull(),
    attendeeCount: integer("attendee_count").notNull().default(0),
  },
  (t) => ({
    uniqQuarter: unique().on(t.seriesId, t.year, t.quarter),
  }),
);

export type AttendanceRow = typeof attendance.$inferSelect;
export type QuarterlyAttendanceCountRow = typeof quarterlyAttendanceCounts.$inferSelect;
