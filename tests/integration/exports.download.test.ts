import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { jsonReq, ctx } from "./helpers/http";
import { makeContactWithEmail } from "./helpers/factories";
import { mailingListExports } from "@/server/db/schema";
import { GET as DOWNLOAD } from "@/app/api/exports/[listId]/route";

// FR-001, FR-009, FR-010, SC-002
describe("GET /api/exports/:listId", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("returns the CSV with the exact filename and records an audit row", async () => {
    await makeContactWithEmail({
      displayName: "Ada Lovelace",
      email: "ada@example.com",
      consentTopics: ["contra"],
    });

    const res = await DOWNLOAD(jsonReq("GET", "/api/exports/contra"), ctx({ listId: "contra" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="contra.csv"');
    const text = await res.text();
    expect(text).toContain("email,first_name,last_name");
    expect(text).toContain("ada@example.com,Ada,Lovelace");

    const audits = await db.select().from(mailingListExports).where(eq(mailingListExports.listId, "contra"));
    expect(audits).toHaveLength(1);
    expect(audits[0]?.rowCount).toBe(1);
  });

  it("404s MAILING_LIST_NOT_FOUND for an unknown list id", async () => {
    const res = await DOWNLOAD(jsonReq("GET", "/api/exports/not-a-list"), ctx({ listId: "not-a-list" }));
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("MAILING_LIST_NOT_FOUND");
  });
});
