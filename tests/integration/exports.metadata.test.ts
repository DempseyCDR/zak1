import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb } from "./helpers/db";
import { jsonReq, ctx } from "./helpers/http";
import { makeContactWithEmail } from "./helpers/factories";
import { GET as METADATA } from "@/app/api/exports/route";
import { GET as DOWNLOAD } from "@/app/api/exports/[listId]/route";

// FR-001, FR-002, FR-004, SC-001 — feature 010 retired the Jane Austen Ball standing list.
describe("GET /api/exports", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("lists exactly 6 standing lists (no janeaustenball) with lastExport null before any download", async () => {
    const res = await METADATA(jsonReq("GET", "/api/exports"), ctx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(6);
    const ids = body.items.map((i: { listId: string }) => i.listId);
    expect(ids).not.toContain("janeaustenball");
    const contra = body.items.find((i: { listId: string }) => i.listId === "contra");
    expect(contra.filename).toBe("contra.csv");
    expect(contra.lastExport).toBeNull();
  });

  it("no longer exposes a note field on listing items", async () => {
    const res = await METADATA(jsonReq("GET", "/api/exports"), ctx());
    const body = await res.json();
    for (const item of body.items) {
      expect(item).not.toHaveProperty("note");
    }
  });

  it("populates lastExport after a download", async () => {
    await makeContactWithEmail({ email: "a@example.com", consentTopics: ["contra"] });
    await DOWNLOAD(jsonReq("GET", "/api/exports/contra"), ctx({ listId: "contra" }));

    const res = await METADATA(jsonReq("GET", "/api/exports"), ctx());
    const body = await res.json();
    const contra = body.items.find((i: { listId: string }) => i.listId === "contra");
    expect(contra.lastExport.rowCount).toBe(1);
    expect(contra.lastExport.createdAt).toBeTruthy();
  });
});
