import { boolean, date, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { eventGroupKindEnum } from "./enums";
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
  kind: eventGroupKindEnum("kind").notNull(),
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
  chargesAdmission: boolean("charges_admission").notNull().default(true),
  // Persisted per-event attendance count (survives the 90-day purge); source for paying dancers.
  attendanceCount: integer("attendance_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SeriesRow = typeof series.$inferSelect;
export type EventGroupRow = typeof eventGroups.$inferSelect;
export type EventRow = typeof events.$inferSelect;
