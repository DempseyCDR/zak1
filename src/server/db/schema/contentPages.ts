import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// Feature 051 (P7-R7): editable public prose pages (Tier-2 CMS). Body is Markdown; `draft_body` is what the
// Webmaster edits/previews, `published_body` is what the public sees (null until first publish, retained on
// unpublish). `published` gates public visibility. Rendered to sanitized HTML on read (never trusted raw).
export const contentPages = pgTable("content_pages", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  draftBody: text("draft_body").notNull(),
  publishedBody: text("published_body"),
  published: boolean("published").notNull().default(false),
  summary: text("summary"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ContentPageRow = typeof contentPages.$inferSelect;
