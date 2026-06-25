import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { series } from "./events";

export const accountMapping = pgTable("account_mapping", {
  lineKey: text("line_key").primaryKey(),
  accountCode: text("account_code").notNull(),
  accountName: text("account_name").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const seriesQboMap = pgTable("series_qbo_map", {
  seriesId: uuid("series_id")
    .primaryKey()
    .references(() => series.id, { onDelete: "cascade" }),
  gateCustomer: text("gate_customer").notNull(),
  qboClass: text("qbo_class").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AccountMappingRow = typeof accountMapping.$inferSelect;
export type SeriesQboMapRow = typeof seriesQboMap.$inferSelect;
