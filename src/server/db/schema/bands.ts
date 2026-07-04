import { boolean, pgTable, text, timestamp, uuid, unique } from "drizzle-orm/pg-core";
import { performers } from "./performers";

export const bands = pgTable("bands", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  bio: text("bio"),
  photoUrl: text("photo_url"),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const bandMembers = pgTable(
  "band_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bandId: uuid("band_id")
      .notNull()
      .references(() => bands.id, { onDelete: "cascade" }),
    performerId: uuid("performer_id")
      .notNull()
      .references(() => performers.id, { onDelete: "restrict" }),
    isLead: boolean("is_lead").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqMember: unique().on(t.bandId, t.performerId),
  }),
);

export type BandRow = typeof bands.$inferSelect;
export type BandMemberRow = typeof bandMembers.$inferSelect;
