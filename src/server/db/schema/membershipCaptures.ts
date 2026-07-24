import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { contacts } from "./contacts";

// Feature 019 (B30): a public capture awaits a matched PayPal notification, then becomes a membership.
export const captureStatusEnum = pgEnum("capture_status", [
  "awaiting_payment",
  "matched",
  "expired",
]);

/**
 * Website-submitted prospective-member info, held server-side awaiting a verified PayPal notification
 * whose payer email matches. Inert until then — not a contact, not a membership. `email` is the match key
 * (compared case-insensitively); when several awaiting captures share an email, the latest wins and older
 * ones are marked `expired`.
 */
export const membershipCaptures = pgTable("membership_captures", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
  status: captureStatusEnum("status").notNull().default("awaiting_payment"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CaptureStatus = (typeof captureStatusEnum.enumValues)[number];
export type MembershipCaptureRow = typeof membershipCaptures.$inferSelect;
