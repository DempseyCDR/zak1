import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { contacts } from "./contacts";
import { membershipStatusEnum } from "./enums";

export const statusChangeAudit = pgTable("status_change_audit", {
  id: uuid("id").primaryKey().defaultRandom(),
  contactId: uuid("contact_id")
    .notNull()
    .references(() => contacts.id, { onDelete: "cascade" }),
  fromStatus: membershipStatusEnum("from_status"),
  toStatus: membershipStatusEnum("to_status").notNull(),
  reason: text("reason").notNull(),
  actor: text("actor"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type StatusChangeAuditRow = typeof statusChangeAudit.$inferSelect;

export const mergeAudit = pgTable("merge_audit", {
  id: uuid("id").primaryKey().defaultRandom(),
  canonicalId: uuid("canonical_id")
    .notNull()
    .references(() => contacts.id),
  mergedId: uuid("merged_id")
    .notNull()
    .references(() => contacts.id),
  actor: text("actor").notNull(),
  relinkedCounts: jsonb("relinked_counts").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type MergeAuditRow = typeof mergeAudit.$inferSelect;
