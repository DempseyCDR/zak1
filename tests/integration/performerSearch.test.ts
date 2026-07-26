import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { makePerformer } from "./helpers/factories";
import { searchPerformers } from "@/server/domain/performers/performerService";

// Feature 020 US2 (FR-012): typeahead over performers by display name (ILIKE, ordered by display name).
describe("searchPerformers", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("matches display name case-insensitively, ordered by display name", async () => {
    await makePerformer("Bob Fabinski");
    await makePerformer("Ann Fabray");
    await makePerformer("Cara Jones");

    const hits = await searchPerformers(db, "fab");
    expect(hits.map((h) => h.displayName)).toEqual(["Ann Fabray", "Bob Fabinski"]);
  });

  it("browses all performers (ordered) on an empty query", async () => {
    await makePerformer("Zoe");
    await makePerformer("Amy");
    const hits = await searchPerformers(db, "");
    expect(hits.map((h) => h.displayName)).toEqual(["Amy", "Zoe"]);
  });

  it("treats LIKE metacharacters as literals, not wildcards", async () => {
    await makePerformer("Bob Fabinski");
    // A bare '%' must not match everything (analyze L1).
    expect(await searchPerformers(db, "%")).toHaveLength(0);
  });
});
