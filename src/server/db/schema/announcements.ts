import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// Feature 056 (P7-R13): the site-wide announcement banner. Each post is a row; the latest by posted_at is the
// CURRENT notice. Active is derived on read (cleared_at IS NULL AND now < posted_at + duration_hours) — no
// scheduler. Independent of event status (feature 018).
export const announcements = pgTable("announcements", {
  id: uuid("id").primaryKey().defaultRandom(),
  text: text("text").notNull(),
  linkLabel: text("link_label"),
  linkUrl: text("link_url"),
  level: text("level").notNull().default("info"),
  durationHours: integer("duration_hours").notNull().default(24),
  postedAt: timestamp("posted_at", { withTimezone: true }).notNull().defaultNow(),
  clearedAt: timestamp("cleared_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AnnouncementRow = typeof announcements.$inferSelect;
