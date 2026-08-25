import { date, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { series } from "./events";

// Feature 054 (P7-R10): admission pricing tiers. A "revision" is the batch of rows sharing one effective_date;
// an event resolves the revision with the greatest effective_date <= its date (see admissionPricingService).
export const admissionPrices = pgTable("admission_prices", {
  id: uuid("id").primaryKey().defaultRandom(),
  seriesId: uuid("series_id")
    .notNull()
    .references(() => series.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  amountCents: integer("amount_cents").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  effectiveDate: date("effective_date").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AdmissionPriceRow = typeof admissionPrices.$inferSelect;
