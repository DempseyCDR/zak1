import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { contactEmails } from "@/server/db/schema";
import { createContact } from "@/server/domain/contacts/contactService";
import { getMergeSuggestions } from "@/server/domain/dedup/suggestionService";

// Feature 033 (P5-R7): the merge suggestion carries phone + ACTIVE emails per candidate; matching unchanged.
describe("dedup suggestion phone + email (033 US1)", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("returns phone + active emails per candidate; excludes inactive; matching unchanged", async () => {
    const a = await createContact(db, {
      firstName: "Chris",
      lastName: "Smith",
      phone: "(585) 555-1234",
    });
    // One active address is surfaced; an inactive one must NOT be.
    await db.insert(contactEmails).values([
      { contactId: a.id, email: "chris.active@example.org", status: "active" },
      { contactId: a.id, email: "chris.old@example.org", status: "inactive" },
    ]);
    const b = await createContact(db, { firstName: "Chris", lastName: "Smith" }); // no phone, no email

    const suggestions = await getMergeSuggestions(db);
    const pairs = suggestions.filter(
      (s) => (s.a.id === a.id && s.b.id === b.id) || (s.a.id === b.id && s.b.id === a.id),
    );
    expect(pairs).toHaveLength(1); // matching unchanged — exactly one pair for the two contacts

    const pair = pairs[0]!;
    const candA = pair.a.id === a.id ? pair.a : pair.b;
    const candB = pair.a.id === b.id ? pair.a : pair.b;

    expect(candA.phone).toBe("+15855551234"); // canonical (feature 032)
    expect(candA.emails).toContain("chris.active@example.org");
    expect(candA.emails).not.toContain("chris.old@example.org"); // inactive excluded

    expect(candB.phone).toBeNull();
    expect(candB.emails).toEqual([]);
  });
});
