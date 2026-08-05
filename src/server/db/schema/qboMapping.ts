import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { series } from "./events";

export const seriesQboMap = pgTable("series_qbo_map", {
  seriesId: uuid("series_id")
    .primaryKey()
    .references(() => series.id, { onDelete: "cascade" }),
  gateCustomer: text("gate_customer").notNull(),
  qboClass: text("qbo_class").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SeriesQboMapRow = typeof seriesQboMap.$inferSelect;
