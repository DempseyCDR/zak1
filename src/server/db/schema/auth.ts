import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { contacts } from "./contacts";

/**
 * A volunteer contact's ability to authenticate via Google (feature 015). Holds no password —
 * Google verifies identity and owns credential recovery.
 *
 * `contactId` is unique (one identity per person) and `googleSub` is unique (one Google account
 * binds to one contact). Eligibility (`contacts.is_volunteer`) is deliberately NOT copied here:
 * it is read live on every session check so withdrawal takes effect immediately (FR-011).
 */
export const staffIdentities = pgTable("staff_identities", {
  id: uuid("id").primaryKey().defaultRandom(),
  contactId: uuid("contact_id")
    .notNull()
    .unique()
    .references(() => contacts.id, { onDelete: "cascade" }),
  // Google's immutable account id — the durable link (email can change; sub cannot).
  googleSub: text("google_sub").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastSignInAt: timestamp("last_sign_in_at", { withTimezone: true }),
});

/**
 * A revocable authenticated period. Server-side rather than a stateless token because FR-011
 * requires ending an ACTIVE session when volunteer access is withdrawn.
 */
export const staffSessions = pgTable(
  "staff_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    staffIdentityId: uuid("staff_identity_id")
      .notNull()
      .references(() => staffIdentities.id, { onDelete: "cascade" }),
    // Hash only: the raw token lives solely in the client cookie.
    tokenHash: text("token_hash").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => ({
    identityIdx: index("staff_sessions_identity_idx").on(t.staffIdentityId),
  }),
);

export type StaffIdentityRow = typeof staffIdentities.$inferSelect;
export type StaffSessionRow = typeof staffSessions.$inferSelect;
