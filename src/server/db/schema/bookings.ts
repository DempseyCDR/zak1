import { boolean, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { events } from "./events";
import { performers } from "./performers";
import { performerTypeEnum } from "./enums";

export const bookings = pgTable("bookings", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  performerId: uuid("performer_id")
    .notNull()
    .references(() => performers.id),
  performerType: performerTypeEnum("performer_type").notNull(),
  payCents: integer("pay_cents").notNull().default(0),
  isDonated: boolean("is_donated").notNull().default(false),
  isOverridden: boolean("is_overridden").notNull().default(false),
  requiresCheck: boolean("requires_check").notNull().default(false),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type BookingRow = typeof bookings.$inferSelect;
