import { date, pgTable, primaryKey, timestamp, uuid } from "drizzle-orm/pg-core";
import { contacts } from "./contacts";
import { membershipLevelEnum } from "./enums";

// Feature 070: the pre-068 `memberships` / `payers` tables were dropped in migration 0045. Membership is
// an ACCOUNT a household holds — see below — not a row per member.

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
