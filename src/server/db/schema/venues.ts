import { doublePrecision, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { contacts } from "./contacts";

export const venues = pgTable("venues", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  // Feature 020 (US5): compact label for the bookings report. Display-only, non-unique; defaults to the
  // name's initials (venueShortNameDefault), with a runtime fallback to those initials when null.
  shortName: text("short_name"),
  address: text("address").notNull(),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  // Feature 018 (B22): optional landlord contact (the party the Booker negotiates rent with).
  landlordContactId: uuid("landlord_contact_id").references(() => contacts.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type VenueRow = typeof venues.$inferSelect;
