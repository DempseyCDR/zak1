import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { makeContactWithEmail } from "./helpers/factories";
import { performers } from "@/server/db/schema";
import { buildListRows } from "@/server/domain/exports/exportService";

// FR-002, FR-002a, FR-003
describe("buildListRows — performer", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("includes a contact referenced by a performers row", async () => {
    const { contactId } = await makeContactWithEmail({
      displayName: "Fiona Fiddle",
      email: "fiona@example.com",
    });
    await db.insert(performers).values({ displayName: "Fiona Fiddle", contactId });
    const rows = await buildListRows(db, "performer");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.email).toBe("fiona@example.com");
  });

  it("excludes a contact with no performers row", async () => {
    await makeContactWithEmail({ email: "not-a-performer@example.com" });
    const rows = await buildListRows(db, "performer");
    expect(rows).toHaveLength(0);
  });

  it("excludes an email explicitly carrying Do Not Contact even for a performer contact", async () => {
    const { contactId } = await makeContactWithEmail({
      email: "dnc-performer@example.com",
      consentTopics: ["do_not_contact"],
    });
    await db.insert(performers).values({ displayName: "DNC Performer", contactId });
    const rows = await buildListRows(db, "performer");
    expect(rows).toHaveLength(0);
  });

  it("excludes a transition/inactive email even when the contact is a performer", async () => {
    const { contactId } = await makeContactWithEmail({
      email: "transition-performer@example.com",
      emailStatus: "transition",
    });
    await db.insert(performers).values({ displayName: "Transition Performer", contactId });
    const rows = await buildListRows(db, "performer");
    expect(rows).toHaveLength(0);
  });
});
