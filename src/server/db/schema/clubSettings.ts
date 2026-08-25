import { integer, pgTable, smallint, text, timestamp } from "drizzle-orm/pg-core";

export const clubSettings = pgTable("club_settings", {
  id: smallint("id").primaryKey().default(1),
  longLapseCycles: integer("long_lapse_cycles").notNull().default(3),
  cycleDefinition: text("cycle_definition").notNull().default("1 year"),
  // Feature 019 (FR-003a): the shared membership-year-end boundary as a MM-DD month-day (year-agnostic).
  // '08-31' confirmed correct (feature 055 / P7-R12 — audit): the club's year runs Sep 1 – Aug 31.
  membershipYearEnd: text("membership_year_end").notNull().default("08-31"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ClubSettingsRow = typeof clubSettings.$inferSelect;
