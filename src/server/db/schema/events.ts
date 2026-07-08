import { boolean, date, integer, pgTable, text, time, timestamp, uuid } from "drizzle-orm/pg-core";
import { venues } from "./venues";

export const series = pgTable("series", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  hasSoundTech: boolean("has_sound_tech").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const eventGroups = pgTable("event_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  // Free-text, optional category (feature 010; was the event_group_kind enum).
  kind: text("kind"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  seriesId: uuid("series_id")
    .notNull()
    .references(() => series.id),
  groupId: uuid("group_id").references(() => eventGroups.id),
  venueId: uuid("venue_id").references(() => venues.id, { onDelete: "set null" }),
  eventDate: date("event_date").notNull(),
  // Display/identification fields (feature 013), all optional. start_time is a venue-local wall-clock
  // time (no time zone); label distinguishes same-day group members; description is a public blurb.
  label: text("label"),
  startTime: time("start_time"),
  description: text("description"),
  chargesAdmission: boolean("charges_admission").notNull().default(true),
  // Per-event rent override / direct rent (feature 011). NULL = resolve from venue_rents layers.
  rentCents: integer("rent_cents"),
  // Persisted per-event attendance count (survives the 90-day purge); source for paying dancers.
  attendanceCount: integer("attendance_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SeriesRow = typeof series.$inferSelect;
export type EventGroupRow = typeof eventGroups.$inferSelect;
export type EventRow = typeof events.$inferSelect;
