import { boolean, jsonb, pgTable, text, timestamp, uuid, unique } from "drizzle-orm/pg-core";
import { performers } from "./performers";
import type { PromoLink } from "@/server/domain/public/promoLinks";

export const bands = pgTable("bands", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  bio: text("bio"),
  photoUrl: text("photo_url"),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  // Feature 053 (P7-R9): public roster fields (see promoLinks.ts). A band is publicly exposable iff is_public
  // AND not archived; styles drive the roster grouping/filter; links are self-published promo links.
  isPublic: boolean("is_public").notNull().default(false),
  styles: text("styles").array().notNull().default([]),
  links: jsonb("links").$type<PromoLink[]>().notNull().default([]),
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
    // Feature 053 (P7-R9): optional instrument shown on the roster/lineup ("Name — instrument").
    instrument: text("instrument"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqMember: unique().on(t.bandId, t.performerId),
  }),
);

export type BandRow = typeof bands.$inferSelect;
export type BandMemberRow = typeof bandMembers.$inferSelect;
