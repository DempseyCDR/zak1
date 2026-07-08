import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { createContact } from "@/server/domain/contacts/contactService";
import { getMergeSuggestions } from "@/server/domain/dedup/suggestionService";

// FR-006, SC-006 — dedup keys on the structured first+last (override-immune; first alone when blank).
describe("duplicate detection on structured names", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("flags same first+last as duplicates even when one has a different display-name override", async () => {
    const a = await createContact(db, { firstName: "Robert", lastName: "Frost" });
    const b = await createContact(db, {
      firstName: "Robert",
      lastName: "Frost",
      displayNameOverride: "Bob Frost",
    });
    const suggestions = await getMergeSuggestions(db);
    const pair = suggestions.find(
      (s) =>
        (s.a.id === a.id && s.b.id === b.id) || (s.a.id === b.id && s.b.id === a.id),
    );
    expect(pair).toBeDefined();
  });

  it("flags two first-only contacts (dedup keys on the first name alone)", async () => {
    await createContact(db, { firstName: "Jane" });
    await createContact(db, { firstName: "Jane" });
    const suggestions = await getMergeSuggestions(db);
    expect(suggestions.length).toBeGreaterThanOrEqual(1);
  });
});
