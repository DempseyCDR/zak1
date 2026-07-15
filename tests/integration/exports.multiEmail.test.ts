import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { makeContactWithEmail } from "./helpers/factories";
import { contactEmails } from "@/server/db/schema";
import { buildListRows } from "@/server/domain/exports/exportService";

// Edge case (Decision 5): one row per qualifying email, never collapsed per contact.
describe("buildListRows — multiple qualifying emails per contact", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("produces two rows for a contact with two qualifying emails on the same list", async () => {
    const { contactId } = await makeContactWithEmail({
      displayName: "Ada Lovelace",
      email: "ada.home@example.com",
      consentTopics: ["contra"],
    });
    await db.insert(contactEmails).values({
      contactId,
      email: "ada.work@example.com",
      consentTopics: ["contra"],
      status: "active",
    });
    const rows = await buildListRows(db, "contra");
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.email).sort()).toEqual([
      "ada.home@example.com",
      "ada.work@example.com",
    ]);
  });
});
