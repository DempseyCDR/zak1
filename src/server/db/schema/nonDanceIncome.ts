import { date, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { events } from "./events";

export const nonDanceIncome = pgTable("non_dance_income", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  amountCents: integer("amount_cents").notNull(),
  entryDate: date("entry_date").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type NonDanceIncomeRow = typeof nonDanceIncome.$inferSelect;
