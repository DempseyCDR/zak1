import { integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { membershipCaptures } from "./membershipCaptures";

// Feature 019 (B30): a verified notification is either matched to a capture or parked for admin linking.
export const notificationStatusEnum = pgEnum("notification_status", [
  "matched",
  "parked",
  "resolved",
]);

/**
 * Every VERIFIED PayPal notification. `providerEventId` UNIQUE is the idempotency guarantee (FR-013) — a
 * replayed notification collides here rather than creating a second membership. Unverifiable notifications
 * are rejected upstream and never stored (storing unverified payloads would make this an unauthenticated
 * write target). `rawPayload` is kept for manual reconciliation of parked payments.
 */
export const paypalNotifications = pgTable("paypal_notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  providerEventId: text("provider_event_id").notNull().unique(),
  eventType: text("event_type").notNull(),
  payerEmail: text("payer_email"),
  amountCents: integer("amount_cents").notNull(),
  captureId: uuid("capture_id").references(() => membershipCaptures.id, { onDelete: "set null" }),
  status: notificationStatusEnum("status").notNull(),
  rawPayload: jsonb("raw_payload").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
});

export type NotificationStatus = (typeof notificationStatusEnum.enumValues)[number];
export type PaypalNotificationRow = typeof paypalNotifications.$inferSelect;
