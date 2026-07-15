import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb, db, TEST_STAFF_DISPLAY_NAME } from "./helpers/db";
import { createContact, searchContacts } from "@/server/domain/contacts/contactService";

// FR-007, FR-008, SC-002 — the door roster browses alphabetically by last name; labels are the
// effective display name.
describe("check-in roster sort", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("orders the browse roster by last then first name", async () => {
    await createContact(db, { firstName: "Ada", lastName: "Lovelace" });
    await createContact(db, { firstName: "Grace", lastName: "Hopper" });
    await createContact(db, { firstName: "Bob", lastName: "Frost" });

    // Exclude the harness's standing staff member (feature 015 seeds one for API auth).
    const roster = (await searchContacts(db, "", 20, { orderBy: "name" })).filter(
      (r) => r.displayName !== TEST_STAFF_DISPLAY_NAME,
    );
    expect(roster.map((r) => r.displayName)).toEqual(["Bob Frost", "Grace Hopper", "Ada Lovelace"]);
  });

  it("labels a roster entry with the effective display name (override wins)", async () => {
    await createContact(db, { firstName: "Robert", lastName: "Frost", displayNameOverride: "Bob Frost" });
    const roster = await searchContacts(db, "", 20, { orderBy: "name" });
    expect(roster.map((r) => r.displayName)).toContain("Bob Frost");
  });
});
