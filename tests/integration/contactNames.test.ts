import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import {
  createContact,
  patchContact,
  getContact,
  searchContacts,
} from "@/server/domain/contacts/contactService";

// FR-001..FR-005, FR-010, SC-001, SC-004, SC-005 — structured names, overridable display, pronouns.
describe("contact structured names", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("defaults display to 'First Last', keeps an override across edits, and clears back to default", async () => {
    const c = await createContact(db, { firstName: "Robert", lastName: "Frost" });
    expect(c.displayName).toBe("Robert Frost");

    await patchContact(db, c.id, { displayNameOverride: "Bob Frost" });
    let row = await getContact(db, c.id);
    expect(row.displayName).toBe("Bob Frost");
    expect(row.firstName).toBe("Robert");
    expect(row.lastName).toBe("Frost");

    // Editing the last name does not disturb the override (FR-004).
    await patchContact(db, c.id, { lastName: "Frost-Smith" });
    row = await getContact(db, c.id);
    expect(row.displayName).toBe("Bob Frost");
    expect(row.lastName).toBe("Frost-Smith");

    // Clearing the override returns to first + last.
    await patchContact(db, c.id, { displayNameOverride: null });
    row = await getContact(db, c.id);
    expect(row.displayName).toBe("Robert Frost-Smith");
  });

  it("allows a blank last name (display = first only) and records pronouns", async () => {
    const jane = await createContact(db, { firstName: "Jane" });
    expect(jane.displayName).toBe("Jane");
    expect(jane.lastName).toBeNull();

    await patchContact(db, jane.id, { pronouns: "she/her" });
    const row = await getContact(db, jane.id);
    expect(row.pronouns).toBe("she/her");
  });

  it("readers see the effective (materialized) display name — no regression (FR-010/SC-005)", async () => {
    const c = await createContact(db, {
      firstName: "Robert",
      lastName: "Frost",
      displayNameOverride: "Bob Frost",
    });
    // The maintained display_name flows to any reader (here: read-back + the directory search result).
    expect((await getContact(db, c.id)).displayName).toBe("Bob Frost");
    const results = await searchContacts(db, "Bob");
    expect(results.find((r) => r.id === c.id)?.displayName).toBe("Bob Frost");
  });
});
