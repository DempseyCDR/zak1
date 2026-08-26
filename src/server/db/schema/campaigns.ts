import { date, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// Feature 057 (P7-R14): the home-page promotional campaign slot. Each campaign is a row; campaigns form a queue.
// The home page shows exactly one — among rows whose window includes today, the one that EXPIRES FIRST (min
// end_date; ties: min start_date, then created_at). Active is derived on read (no scheduler). `date` columns
// surface as YYYY-MM-DD strings (Drizzle default), matching the app's string-date convention.
export const campaigns = pgTable("campaigns", {
  id: uuid("id").primaryKey().defaultRandom(),
  heading: text("heading").notNull(),
  blurb: text("blurb").notNull(),
  imageUrl: text("image_url"),
  imageAlt: text("image_alt"),
  ctaLabel: text("cta_label").notNull(),
  ctaUrl: text("cta_url").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CampaignRow = typeof campaigns.$inferSelect;
