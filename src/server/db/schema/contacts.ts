import { sql } from "drizzle-orm";
import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { membershipStatusEnum, volunteerRoleEnum } from "./enums";

export const contacts = pgTable("contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  displayName: text("display_name").notNull(),
  nameNormalized: text("name_normalized").notNull(),
  membershipStatus: membershipStatusEnum("membership_status").notNull().default("never"),
  listMember: boolean("list_member").notNull().default(false),
  statusRecomputedAt: timestamp("status_recomputed_at", { withTimezone: true }),
  isVolunteer: boolean("is_volunteer").notNull().default(false),
  volunteerRoles: volunteerRoleEnum("volunteer_roles")
    .array()
    .notNull()
    .default(sql`'{}'`),
  mergedIntoId: uuid("merged_into_id"),
  needsReview: boolean("needs_review").notNull().default(false),
  source: text("source"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ContactRow = typeof contacts.$inferSelect;
export type NewContactRow = typeof contacts.$inferInsert;
