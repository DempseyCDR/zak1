import { sql } from "drizzle-orm";
import { check, index, pgEnum, pgTable, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { contacts } from "./contacts";
import { eventGroups, series } from "./events";

/**
 * Role grants (feature 016) — the unit the President/VP issues and revokes.
 *
 * The ten grants. `organizer` is deliberately absent: it is the implicit BASE held by every
 * authenticated volunteer (FR-001), not something you hold a row for. A row saying "organizer" would
 * be a fact the evaluator must then ignore, and would make the base revocable.
 */
export const roleEnum = pgEnum("role", [
  "door_attendant",
  "booker",
  "financial_secretary",
  "treasurer",
  "vice_president",
  "webmaster",
  "mailing_list_manager",
  "secretary",
  "president",
  "super_user",
]);

export type Role = (typeof roleEnum.enumValues)[number];

/**
 * SCOPE IS THE SHAPE OF THE ROW, NOT A COLUMN (data-model.md §3):
 *   series_id NULL, group_id NULL  → club-wide
 *   series_id set,  group_id NULL  → per-series
 *   series_id NULL, group_id set   → per-event-group
 *
 * Group and series are ORTHOGONAL axes, not a hierarchy — event groups deliberately span series, so a
 * group grant reaching an event in a series the holder has no authority over is intended. Two
 * independent nullable FKs say that structurally; a single polymorphic `scope_id` would imply a tree,
 * and `ON DELETE SET NULL` on it would silently promote a series grant to club-wide (club-wide IS the
 * null state). Real FKs refuse the delete instead.
 *
 * There is deliberately NO uniqueness on role or (role, series_id): two people may hold President
 * (FR-005c). President/VP/Treasurer exclusivity is a cross-ROW invariant and lives in the service.
 */
export const roleGrants = pgTable(
  "role_grants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Grants die with the person.
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    role: roleEnum("role").notNull(),
    seriesId: uuid("series_id").references(() => series.id),
    groupId: uuid("group_id").references(() => eventGroups.id),
    // Not cascaded: the record of who granted authority outlives the granter. NULL = operator CLI.
    grantedBy: uuid("granted_by").references(() => contacts.id),
    grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    scopeExclusive: check("grant_scope_exclusive", sql`num_nonnulls(${t.seriesId}, ${t.groupId}) <= 1`),
    // NULLS NOT DISTINCT is load-bearing: a plain UNIQUE would catch NOTHING, because
    // grant_scope_exclusive guarantees at least one scope column is always NULL and Postgres treats
    // NULLs as distinct. Still permits the same role at two different series (FR-005).
    grantUnique: unique("role_grants_unique")
      .on(t.contactId, t.role, t.seriesId, t.groupId)
      .nullsNotDistinct(),
    contactIdx: index("role_grants_contact_idx").on(t.contactId),
  }),
);

export type RoleGrantRow = typeof roleGrants.$inferSelect;
export type NewRoleGrantRow = typeof roleGrants.$inferInsert;
