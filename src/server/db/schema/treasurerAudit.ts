import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { events } from "./events";

export const mappingAudit = pgTable("mapping_audit", {
  id: uuid("id").primaryKey().defaultRandom(),
  mappingKind: text("mapping_kind").notNull(),
  key: text("key").notNull(),
  details: jsonb("details").notNull().default({}),
  actor: text("actor"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const treasurerReportAudit = pgTable("treasurer_report_audit", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  actor: text("actor"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type MappingAuditRow = typeof mappingAudit.$inferSelect;
export type TreasurerReportAuditRow = typeof treasurerReportAudit.$inferSelect;
