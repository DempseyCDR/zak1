import { date, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { contacts } from "./contacts";
import { membershipLevelEnum } from "./enums";

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
  // Feature 044: membership tier from the CDR workbook Payer sheet. Backfilled to 'individual' for rows
  // predating the contact load (migration 0033).
  level: membershipLevelEnum("level").notNull().default("individual"),
  // Feature 019: acquisition-channel provenance. Both nullable — an admin-entered membership has neither.
  // The partial unique indexes on these (migration 0024) make the door (replace-all gate save, R5) and
  // online (webhook replay, FR-013) channels idempotent: a re-save/replay collides instead of duplicating.
  sourceGateSaleId: uuid("source_gate_sale_id"),
  sourceNotificationId: uuid("source_notification_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PayerRow = typeof payers.$inferSelect;
export type MembershipRow = typeof memberships.$inferSelect;

/**
 * Feature 068 (M-R/FR-001): a membership ACCOUNT — what a household buys.
 *
 * Owned by a payer contact, carrying the level (the payer's attribute) and the validity period
 * (everyone's). Durable: a further payment moves `expiryDate` forward and may change the level; it never
 * inserts a second account (unique on the payer).
 */
export const membershipAccounts = pgTable("membership_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  // No onDelete: deleting a payer's contact must be REFUSED, not absorbed (FR-009).
  payerContactId: uuid("payer_contact_id")
    .notNull()
    .references(() => contacts.id),
  level: membershipLevelEnum("level").notNull(),
  expiryDate: date("expiry_date").notNull(),
  lastPaymentDate: date("last_payment_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Feature 068 (FR-011): the attachment that makes a contact a MEMBER. The payer is attached
 * automatically; the rest of the household is added. Untouched by renewal — and this, not
 * `contacts.list_member`, is what the member mailing list is built from.
 */
export const membershipMembers = pgTable(
  "membership_members",
  {
    accountId: uuid("account_id")
      .notNull()
      .references(() => membershipAccounts.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    attachedAt: timestamp("attached_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.accountId, t.contactId] })],
);

export type MembershipAccountRow = typeof membershipAccounts.$inferSelect;
export type MembershipMemberRow = typeof membershipMembers.$inferSelect;
