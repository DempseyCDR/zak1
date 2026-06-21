import { date, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { rateKindEnum } from "./enums";

export const rateParameters = pgTable("rate_parameters", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: rateKindEnum("kind").notNull(),
  amountCents: integer("amount_cents").notNull(),
  effectiveDate: date("effective_date").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const rateParameterAudit = pgTable("rate_parameter_audit", {
  id: uuid("id").primaryKey().defaultRandom(),
  rateKind: rateKindEnum("rate_kind").notNull(),
  amountCents: integer("amount_cents").notNull(),
  effectiveDate: date("effective_date").notNull(),
  actor: text("actor"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type RateParameterRow = typeof rateParameters.$inferSelect;
export type RateParameterAuditRow = typeof rateParameterAudit.$inferSelect;
