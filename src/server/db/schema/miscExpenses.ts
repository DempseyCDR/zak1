import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { events } from "./events";

export const miscExpenses = pgTable("misc_expenses", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  amountCents: integer("amount_cents").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type MiscExpenseRow = typeof miscExpenses.$inferSelect;
