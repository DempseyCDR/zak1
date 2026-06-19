import { sql } from "drizzle-orm";
import { boolean, customType, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { emailConsentTopicEnum, emailPurposeEnum, emailStatusEnum } from "./enums";
import { contacts } from "./contacts";

// citext column type (case-insensitive text).
const citext = customType<{ data: string }>({
  dataType() {
    return "citext";
  },
});

export const contactEmails = pgTable("contact_emails", {
  id: uuid("id").primaryKey().defaultRandom(),
  contactId: uuid("contact_id")
    .notNull()
    .references(() => contacts.id, { onDelete: "cascade" }),
  email: citext("email").notNull(),
  purposes: emailPurposeEnum("purposes")
    .array()
    .notNull()
    .default(sql`'{personal}'`),
  consentTopics: emailConsentTopicEnum("consent_topics")
    .array()
    .notNull()
    .default(sql`'{contact_tracing}'`),
  status: emailStatusEnum("status").notNull().default("active"),
  isLogin: boolean("is_login").notNull().default(false),
  providerSetDate: timestamp("provider_set_date", { withTimezone: true }),
  providerLastOpen: timestamp("provider_last_open", { withTimezone: true }),
  providerLastClick: timestamp("provider_last_click", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ContactEmailRow = typeof contactEmails.$inferSelect;
export type NewContactEmailRow = typeof contactEmails.$inferInsert;
