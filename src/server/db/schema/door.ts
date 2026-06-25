import { integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { contacts } from "./contacts";
import { events } from "./events";
import { gateCategoryEnum, paymentMethodEnum } from "./enums";

export const doorRecords = pgTable("door_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id")
    .notNull()
    .unique()
    .references(() => events.id, { onDelete: "cascade" }),
  posTransactionCount: integer("pos_transaction_count").notNull().default(0),
  pcGrossCents: integer("pc_gross_cents").notNull().default(0),
  posFeeCents: integer("pos_fee_cents").notNull().default(0),
  grossCashCents: integer("gross_cash_cents").notNull().default(0),
  seedFloatCents: integer("seed_float_cents").notNull().default(1500),
  cashPaidOutCents: integer("cash_paid_out_cents").notNull().default(0),
  cashPaidOutReason: text("cash_paid_out_reason"),
  depositCents: integer("deposit_cents").notNull().default(0),
  giftCardRedemptionCount: integer("gift_card_redemption_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const gateSales = pgTable("gate_sales", {
  id: uuid("id").primaryKey().defaultRandom(),
  doorRecordId: uuid("door_record_id")
    .notNull()
    .references(() => doorRecords.id, { onDelete: "cascade" }),
  category: gateCategoryEnum("category").notNull(),
  paymentMethod: paymentMethodEnum("payment_method").notNull(),
  amountCents: integer("amount_cents").notNull().default(0),
  // Required for named categories (donation/future_event/membership); null = anonymous.
  contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
});

export const doorRecordAudit = pgTable("door_record_audit", {
  id: uuid("id").primaryKey().defaultRandom(),
  doorRecordId: uuid("door_record_id")
    .notNull()
    .references(() => doorRecords.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  actor: text("actor"),
  details: jsonb("details").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type DoorRecordRow = typeof doorRecords.$inferSelect;
export type GateSaleRow = typeof gateSales.$inferSelect;
export type DoorRecordAuditRow = typeof doorRecordAudit.$inferSelect;
