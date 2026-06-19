import { integer, pgTable, smallint, text, timestamp } from "drizzle-orm/pg-core";

export const clubSettings = pgTable("club_settings", {
  id: smallint("id").primaryKey().default(1),
  longLapseCycles: integer("long_lapse_cycles").notNull().default(3),
  cycleDefinition: text("cycle_definition").notNull().default("1 year"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ClubSettingsRow = typeof clubSettings.$inferSelect;
