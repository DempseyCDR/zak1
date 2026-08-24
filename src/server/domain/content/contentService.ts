import { and, asc, eq } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import { contentPages, type ContentPageRow } from "@/server/db/schema";
import { errors } from "@/server/lib/apiError";
import { recordAudit } from "@/server/lib/audit";
import type { ContentPageCreateInput, ContentPagePatchInput } from "@/server/validation/content";

// Feature 051 (P7-R7): content-page CRUD + the draft→published lifecycle. The public read (`getContentPageBySlug`)
// exposes the PUBLISHED body only; editing the draft never changes the public page until `publishContentPage`.
// Every write records a durable audit row (recordAudit — not the log-only writeAudit) so FR-006 is queryable.

export type ContentPageListItem = {
  id: string;
  slug: string;
  title: string;
  published: boolean;
  updatedAt: Date;
};

/** Create a new page as an unpublished draft. Rejects a slug already in use. */
export async function createContentPage(
  db: Db,
  input: ContentPageCreateInput,
  actorContactId: string | null,
): Promise<ContentPageRow> {
  const existing = await db.query.contentPages.findFirst({
    where: eq(contentPages.slug, input.slug),
  });
  if (existing) throw errors.contentSlugTaken();

  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(contentPages)
      .values({
        slug: input.slug,
        title: input.title,
        draftBody: input.draftBody,
        summary: input.summary ?? null,
      })
      .returning();
    if (!row) throw new Error("content page insert failed");
    await recordAudit(tx, {
      kind: "content.created",
      actorContactId,
      details: { id: row.id, slug: row.slug },
    });
    return row;
  });
}

/** Edit the DRAFT (title/body/summary). Never changes the published body or visibility. */
export async function patchContentPage(
  db: Db,
  id: string,
  input: ContentPagePatchInput,
  actorContactId: string | null,
): Promise<ContentPageRow> {
  return db.transaction(async (tx) => {
    const existing = await tx.query.contentPages.findFirst({ where: eq(contentPages.id, id) });
    if (!existing) throw errors.contentPageNotFound();
    const [row] = await tx
      .update(contentPages)
      .set({
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.draftBody !== undefined ? { draftBody: input.draftBody } : {}),
        ...(input.summary !== undefined ? { summary: input.summary } : {}),
        updatedAt: new Date(),
      })
      .where(eq(contentPages.id, id))
      .returning();
    await recordAudit(tx, { kind: "content.updated", actorContactId, details: { id } });
    return row!;
  });
}

/** Publish: promote the draft body to the published body the public sees. */
export async function publishContentPage(
  db: Db,
  id: string,
  actorContactId: string | null,
): Promise<ContentPageRow> {
  return db.transaction(async (tx) => {
    const existing = await tx.query.contentPages.findFirst({ where: eq(contentPages.id, id) });
    if (!existing) throw errors.contentPageNotFound();
    const [row] = await tx
      .update(contentPages)
      .set({ publishedBody: existing.draftBody, published: true, updatedAt: new Date() })
      .where(eq(contentPages.id, id))
      .returning();
    await recordAudit(tx, { kind: "content.published", actorContactId, details: { id } });
    return row!;
  });
}

/** Unpublish: hide the page from the public (retains the published body for a later re-publish). */
export async function unpublishContentPage(
  db: Db,
  id: string,
  actorContactId: string | null,
): Promise<ContentPageRow> {
  return db.transaction(async (tx) => {
    const existing = await tx.query.contentPages.findFirst({ where: eq(contentPages.id, id) });
    if (!existing) throw errors.contentPageNotFound();
    const [row] = await tx
      .update(contentPages)
      .set({ published: false, updatedAt: new Date() })
      .where(eq(contentPages.id, id))
      .returning();
    await recordAudit(tx, { kind: "content.unpublished", actorContactId, details: { id } });
    return row!;
  });
}

/** Delete a page. */
export async function deleteContentPage(
  db: Db,
  id: string,
  actorContactId: string | null,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [row] = await tx.delete(contentPages).where(eq(contentPages.id, id)).returning();
    if (!row) throw errors.contentPageNotFound();
    await recordAudit(tx, {
      kind: "content.deleted",
      actorContactId,
      details: { id, slug: row.slug },
    });
  });
}

/** All pages with their state, for the admin list. */
export async function listContentPages(db: Db): Promise<ContentPageListItem[]> {
  return db
    .select({
      id: contentPages.id,
      slug: contentPages.slug,
      title: contentPages.title,
      published: contentPages.published,
      updatedAt: contentPages.updatedAt,
    })
    .from(contentPages)
    .orderBy(asc(contentPages.slug));
}

/** One page (incl. the draft) by id, for the editor. Null if unknown. */
export async function getContentPageById(db: Db, id: string): Promise<ContentPageRow | null> {
  const row = await db.query.contentPages.findFirst({ where: eq(contentPages.id, id) });
  return row ?? null;
}

/** The PUBLISHED page for a slug (public read) — null unless it exists and is published. */
export async function getContentPageBySlug(db: Db, slug: string): Promise<ContentPageRow | null> {
  const row = await db.query.contentPages.findFirst({
    where: and(eq(contentPages.slug, slug), eq(contentPages.published, true)),
  });
  return row ?? null;
}
