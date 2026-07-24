import { date, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { contacts } from "./contacts";

export const payers = pgTable("payers", {
  id: uuid("id").primaryKey().defaultRandom(),
  contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const memberships = pgTable("memberships", {
  id: uuid("id").primaryKey().defaultRandom(),
  contactId: uuid("contact_id")
    .notNull()
    .references(() => contacts.id, { onDelete: "cascade" }),
  payerId: uuid("payer_id")
    .notNull()
    .references(() => payers.id),
  // date column, returned as 'YYYY-MM-DD' string.
  expiryDate: date("expiry_date").notNull(),
  // Feature 019: acquisition-channel provenance. Both nullable — an admin-entered membership has neither.
  // The partial unique indexes on these (migration 0024) make the door (replace-all gate save, R5) and
  // online (webhook replay, FR-013) channels idempotent: a re-save/replay collides instead of duplicating.
  sourceGateSaleId: uuid("source_gate_sale_id"),
  sourceNotificationId: uuid("source_notification_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PayerRow = typeof payers.$inferSelect;
export type MembershipRow = typeof memberships.$inferSelect;
