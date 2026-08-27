import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { auditEvents } from "@/server/db/schema";
import {
  createContentPage,
  patchContentPage,
  publishContentPage,
  unpublishContentPage,
  deleteContentPage,
  listContentPages,
  getContentPageById,
  getContentPageBySlug,
} from "@/server/domain/content/contentService";
import { contentPageCreateSchema } from "@/server/validation/content";

async function auditKinds(): Promise<string[]> {
  const rows = await db.select({ kind: auditEvents.kind }).from(auditEvents);
  return rows.map((r) => r.kind);
}

// Feature 051 (P7-R7): the content-pages service. The load-bearing invariant is draft-vs-published — the
// public read exposes the PUBLISHED body only, never the draft, and unpublish takes it down.
describe("contentService", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("creates a draft that is not yet public, and audits it", async () => {
    const page = await createContentPage(
      db,
      { slug: "mission", title: "Our Mission", draftBody: "# Mission\n\nWe dance." },
      null,
    );
    expect(page.published).toBe(false);
    expect(page.publishedBody).toBeNull();
    // Not public until published.
    expect(await getContentPageBySlug(db, "mission")).toBeNull();
    expect(await auditKinds()).toContain("content.created");
  });

  it("publishes the draft to the public body; editing the draft does not change the public page until re-publish", async () => {
    const page = await createContentPage(
      db,
      { slug: "mission", title: "Our Mission", draftBody: "First version." },
      null,
    );
    await publishContentPage(db, page.id, null);

    let publicPage = await getContentPageBySlug(db, "mission");
    expect(publicPage?.publishedBody).toBe("First version.");

    // Edit the draft only — the public page must be UNCHANGED.
    await patchContentPage(db, page.id, { draftBody: "Second version." }, null);
    publicPage = await getContentPageBySlug(db, "mission");
    expect(publicPage?.publishedBody).toBe("First version."); // still the published body

    // Publish again → now the edit is public.
    await publishContentPage(db, page.id, null);
    publicPage = await getContentPageBySlug(db, "mission");
    expect(publicPage?.publishedBody).toBe("Second version.");

    const kinds = await auditKinds();
    expect(kinds).toContain("content.published");
    expect(kinds).toContain("content.updated");
  });

  it("unpublish takes the page down (public read 404s / null), retaining the published body", async () => {
    const page = await createContentPage(
      db,
      { slug: "bylaws", title: "Bylaws", draftBody: "The rules." },
      null,
    );
    await publishContentPage(db, page.id, null);
    expect(await getContentPageBySlug(db, "bylaws")).not.toBeNull();

    await unpublishContentPage(db, page.id, null);
    expect(await getContentPageBySlug(db, "bylaws")).toBeNull();
    // published_body retained for a re-publish without re-editing
    const row = await getContentPageById(db, page.id);
    expect(row?.publishedBody).toBe("The rules.");
    expect(await auditKinds()).toContain("content.unpublished");
  });

  it("deletes a page (and audits it)", async () => {
    const page = await createContentPage(db, { slug: "temp", title: "Temp", draftBody: "x" }, null);
    await deleteContentPage(db, page.id, null);
    expect(await getContentPageById(db, page.id)).toBeNull();
    expect(await auditKinds()).toContain("content.deleted");
  });

  it("rejects a duplicate slug", async () => {
    await createContentPage(db, { slug: "about", title: "About", draftBody: "a" }, null);
    await expect(
      createContentPage(db, { slug: "about", title: "About 2", draftBody: "b" }, null),
    ).rejects.toThrow();
  });

  it("rejects a reserved slug at the validation boundary", () => {
    expect(
      contentPageCreateSchema.safeParse({ slug: "gate", title: "x", draftBody: "y" }).success,
    ).toBe(false);
    // Feature 058 (P7-R15): the printable-calendar route is reserved.
    expect(
      contentPageCreateSchema.safeParse({ slug: "printable-calendar", title: "x", draftBody: "y" })
        .success,
    ).toBe(false);
    expect(
      contentPageCreateSchema.safeParse({ slug: "mission", title: "x", draftBody: "y" }).success,
    ).toBe(true);
  });

  it("lists pages with their state", async () => {
    const a = await createContentPage(db, { slug: "a", title: "A", draftBody: "a" }, null);
    await publishContentPage(db, a.id, null);
    await createContentPage(db, { slug: "b", title: "B", draftBody: "b" }, null);
    const list = await listContentPages(db);
    expect(list.map((p) => p.slug).sort()).toEqual(["a", "b"]);
    expect(list.find((p) => p.slug === "a")?.published).toBe(true);
    expect(list.find((p) => p.slug === "b")?.published).toBe(false);
  });

  it("keeps the audit row's actor when a real contact id is not supplied (null system actor)", async () => {
    await createContentPage(db, { slug: "x", title: "X", draftBody: "x" }, null);
    const [row] = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.kind, "content.created"));
    expect(row?.actorContactId).toBeNull();
  });
});
