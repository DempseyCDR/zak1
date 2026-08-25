import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { contacts } from "./contacts";

// Feature 055 (P7-R12): the current holder of each board-seat role (role_key from the committed club-role
// registry). One row per role. Order/name/alias are the registry's; the person's name is joined from contacts.
export const officers = pgTable("officers", {
  id: uuid("id").primaryKey().defaultRandom(),
  roleKey: text("role_key").notNull().unique(),
  contactId: uuid("contact_id")
    .notNull()
    .references(() => contacts.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type OfficerRow = typeof officers.$inferSelect;
