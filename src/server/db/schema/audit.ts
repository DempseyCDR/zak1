import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { contacts } from "./contacts";
import { membershipStatusEnum } from "./enums";

/**
 * The general audit trail (feature 016).
 *
 * `writeAudit` wrote only log lines until now, and said so: "For the MVP the audit sink is the
 * structured log; dedicated audit tables are introduced with those stories." This is that story —
 * "which volunteer saw the most contacts' PII last month, and how many" must be answerable in SQL
 * without scanning application logs, and the grant/revoke trail must be durable.
 *
 * `kind` is text, not an enum: the union already has ~40 values and grows every feature, and nothing
 * joins on it. An enum would mean an ALTER TYPE per feature for no gain.
 *
 * The two tables below it (status_change_audit, merge_audit) predate this and stay as they are: they
 * carry typed, queried columns rather than a generic detail bag.
 */
export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind").notNull(),
    actorContactId: uuid("actor_contact_id").references(() => contacts.id),
    details: jsonb("details").notNull().default({}),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    occurredIdx: index("audit_events_occurred_idx").on(t.occurredAt),
    kindIdx: index("audit_events_kind_idx").on(t.kind, t.occurredAt),
    // SC-014's question is "which volunteer, last month, how many" — this is that index.
    actorIdx: index("audit_events_actor_idx").on(t.actorContactId, t.occurredAt),
  }),
);

export type AuditEventRow = typeof auditEvents.$inferSelect;

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
