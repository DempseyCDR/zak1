import { date, integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { series } from "./events";

export const parameterCategoryEnum = pgEnum("parameter_category", ["rate", "expense"]);
export const parameterKindEnum = pgEnum("parameter_kind", [
  "caller",
  "sound_tech",
  "musician",
  "rent",
  "ongoing",
]);

export const seriesParameters = pgTable("series_parameters", {
  id: uuid("id").primaryKey().defaultRandom(),
  category: parameterCategoryEnum("category").notNull(),
  kind: parameterKindEnum("kind").notNull(),
  seriesId: uuid("series_id")
    .notNull()
    .references(() => series.id, { onDelete: "cascade" }),
  amountCents: integer("amount_cents").notNull(),
  label: text("label"),
  effectiveDate: date("effective_date").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// series_id is nullable here only for migrated pre-series-scoping legacy rate history;
// every new row going forward has a real series_id.
export const seriesParameterAudit = pgTable("series_parameter_audit", {
  id: uuid("id").primaryKey().defaultRandom(),
  category: parameterCategoryEnum("category").notNull(),
  kind: parameterKindEnum("kind").notNull(),
  seriesId: uuid("series_id").references(() => series.id, { onDelete: "set null" }),
  amountCents: integer("amount_cents").notNull(),
  label: text("label"),
  effectiveDate: date("effective_date").notNull(),
  actor: text("actor"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ParameterCategory = (typeof parameterCategoryEnum.enumValues)[number];
export type ParameterKind = (typeof parameterKindEnum.enumValues)[number];
export type SeriesParameterRow = typeof seriesParameters.$inferSelect;
export type SeriesParameterAuditRow = typeof seriesParameterAudit.$inferSelect;
