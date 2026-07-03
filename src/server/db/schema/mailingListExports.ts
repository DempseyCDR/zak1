import { integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { events } from "./events";

export const mailingListIdEnum = pgEnum("mailing_list_id", [
  "contra",
  "english",
  "openband",
  "specialevents",
  "janeaustenball",
  "performer",
  "member",
  "contact_tracing",
]);

export const mailingListExports = pgTable("mailing_list_exports", {
  id: uuid("id").primaryKey().defaultRandom(),
  listId: mailingListIdEnum("list_id").notNull(),
  eventId: uuid("event_id").references(() => events.id, { onDelete: "set null" }),
  rowCount: integer("row_count").notNull(),
  actor: text("actor"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type MailingListId = (typeof mailingListIdEnum.enumValues)[number];
export type MailingListExportRow = typeof mailingListExports.$inferSelect;
