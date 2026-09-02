import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { contacts } from "@/server/db/schema";
import { contactRow } from "./helpers/factories";
import { countNeedsReview } from "@/server/domain/contacts/contactService";
import { countMergeSuggestions } from "@/server/domain/dedup/suggestionService";
import { GET as LAUNCHER_COUNTS } from "@/app/api/contacts/launcher-counts/route";
import { jsonReq, ctx } from "./helpers/http";

// File-level DB lifecycle (single closeDb for the shared pool).
beforeAll(ensureSchema);
beforeEach(resetDb);
afterAll(closeDb);

// Feature 064: the launcher fetches two counts on load — needs-review contacts and duplicate pairs.
describe("launcher counts (feature 064)", () => {
  it("countNeedsReview counts only flagged, non-merged contacts (C2)", async () => {
    await db.insert(contacts).values([
      { ...contactRow("Amy Flag"), needsReview: true },
      { ...contactRow("Bob Flag"), needsReview: true },
      { ...contactRow("Cara Clean"), needsReview: false },
    ]);
    expect(await countNeedsReview(db)).toBe(2);
  });

  it("countMergeSuggestions counts candidate duplicate pairs (C3)", async () => {
    await db
      .insert(contacts)
      .values([contactRow("Jon Smith"), contactRow("John Smith"), contactRow("Zelda Fitzgerald")]);
    expect(await countMergeSuggestions(db)).toBeGreaterThanOrEqual(1);
  });

  it("GET /api/contacts/launcher-counts returns both counts (C4)", async () => {
    await db
      .insert(contacts)
      .values([
        { ...contactRow("Amy Flag"), needsReview: true },
        contactRow("Jon Smith"),
        contactRow("John Smith"),
      ]);
    const res = await LAUNCHER_COUNTS(jsonReq("GET", "/api/contacts/launcher-counts"), ctx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.needsReview).toBe(1);
    expect(body.duplicates).toBeGreaterThanOrEqual(1);
  });
});
