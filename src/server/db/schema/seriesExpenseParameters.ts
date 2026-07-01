import { date, integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { series } from "./events";

export const seriesExpenseKindEnum = pgEnum("series_expense_kind", ["rent", "ongoing"]);

export const seriesExpenseParameters = pgTable("series_expense_parameters", {
  id: uuid("id").primaryKey().defaultRandom(),
  seriesId: uuid("series_id")
    .notNull()
    .references(() => series.id, { onDelete: "cascade" }),
  kind: seriesExpenseKindEnum("kind").notNull(),
  amountCents: integer("amount_cents").notNull(),
  label: text("label"),
  effectiveDate: date("effective_date").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SeriesExpenseKind = (typeof seriesExpenseKindEnum.enumValues)[number];
export type SeriesExpenseParameterRow = typeof seriesExpenseParameters.$inferSelect;
