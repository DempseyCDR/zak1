import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { contacts } from "@/server/db/schema";
import { contactRow } from "./helpers/factories";
import { GET as SUGGESTIONS } from "@/app/api/dedup/suggestions/route";
import { jsonReq, ctx } from "./helpers/http";
import { getMergeSuggestions } from "@/server/domain/dedup/suggestionService";
import { createContact } from "@/server/domain/contacts/contactService";

// File-level DB lifecycle (shared across the describes below — a single closeDb for the pool).
beforeAll(ensureSchema);
beforeEach(resetDb);
afterAll(closeDb);

// Feature 062 (M-R4): query-scoped duplicate suggestions — hybrid (scoped with a query, global when
// empty), still detected on the structured-name key so a display override can't mask a duplicate.
describe("getMergeSuggestions — query filter (feature 062)", () => {
  const pairNames = (pairs: { a: { displayName: string }; b: { displayName: string } }[]) =>
    pairs.map((p) => [p.a.displayName, p.b.displayName].sort().join(" / ")).sort();

  it("with a query, returns ONLY pairs where a member matches (C1); empty query is global (C2)", async () => {
    await db
      .insert(contacts)
      .values([
        contactRow("Jon Smith"),
        contactRow("John Smith"),
        contactRow("Zelda Fitzgerald"),
        contactRow("Zelda Fitzgerold"),
      ]);

    const scoped = await getMergeSuggestions(db, 0.4, 50, "smith");
    expect(pairNames(scoped)).toEqual(["John Smith / Jon Smith"]);

    const global = await getMergeSuggestions(db, 0.4, 50);
    expect(pairNames(global)).toEqual([
      "John Smith / Jon Smith",
      "Zelda Fitzgerald / Zelda Fitzgerold",
    ]);
  });

  it("surfaces a duplicate hidden by a display-name override (C3)", async () => {
    await createContact(db, { firstName: "David", lastName: "Jones", displayNameOverride: "DJ" });
    await createContact(db, { firstName: "David", lastName: "Jones" });
    // Searching the real name finds the pair even though one is displayed as "DJ".
    const scoped = await getMergeSuggestions(db, 0.4, 50, "david");
    expect(scoped.length).toBe(1);
    const names = [scoped[0]!.a.displayName, scoped[0]!.b.displayName].sort();
    expect(names).toEqual(["DJ", "David Jones"]);
  });
});

// FR-010
describe("GET /api/dedup/suggestions", () => {
  async function seed(name: string) {
    await db.insert(contacts).values(contactRow(name));
  }

  it("surfaces similar-name pairs with a similarity score", async () => {
    await seed("Jon Smith");
    await seed("John Smith");
    await seed("Zelda Fitzgerald");

    const res = await SUGGESTIONS(jsonReq("GET", "/api/dedup/suggestions"), ctx());
    const body = await res.json();
    expect(body.pairs.length).toBeGreaterThanOrEqual(1);
    const pair = body.pairs[0];
    const names = [pair.a.displayName, pair.b.displayName].sort();
    expect(names).toEqual(["John Smith", "Jon Smith"]);
    expect(pair.similarity).toBeGreaterThan(0.4);
  });
});
