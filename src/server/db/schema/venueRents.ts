import { date, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { series } from "./events";
import { venues } from "./venues";

// Rent keyed by (venue, series): series_id NULL = venue default; series_id set = series-at-venue
// override. Effective-dated (feature 011). Per-event overrides live on events.rent_cents.
export const venueRents = pgTable("venue_rents", {
  id: uuid("id").primaryKey().defaultRandom(),
  venueId: uuid("venue_id")
    .notNull()
    .references(() => venues.id, { onDelete: "cascade" }),
  seriesId: uuid("series_id").references(() => series.id, { onDelete: "cascade" }),
  amountCents: integer("amount_cents").notNull(),
  effectiveDate: date("effective_date").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Nullable FKs (SET NULL) so audit history survives venue/series deletion.
export const venueRentAudit = pgTable("venue_rent_audit", {
  id: uuid("id").primaryKey().defaultRandom(),
  venueId: uuid("venue_id").references(() => venues.id, { onDelete: "set null" }),
  seriesId: uuid("series_id").references(() => series.id, { onDelete: "set null" }),
  amountCents: integer("amount_cents").notNull(),
  effectiveDate: date("effective_date").notNull(),
  actor: text("actor"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type VenueRentRow = typeof venueRents.$inferSelect;
export type VenueRentAuditRow = typeof venueRentAudit.$inferSelect;
