import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { contacts, performers } from "@/server/db/schema";
import { createPerformer } from "@/server/domain/performers/performerService";

// FR-015: every performer has a contact so the door can check them in.
describe("performer → contact", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("auto-creates a contact when none is linked", async () => {
    const p = await createPerformer(db, { displayName: "Fiona Fiddle" });
    expect(p.contactId).toBeTruthy();
    const contact = await db.query.contacts.findFirst({ where: eq(contacts.id, p.contactId!) });
    expect(contact?.displayName).toBe("Fiona Fiddle");
    expect(contact?.source).toBe("performer");
  });

  it("reuses an existing contact when one is provided", async () => {
    const [existing] = await db
      .insert(contacts)
      .values({ displayName: "Existing", nameNormalized: "existing" })
      .returning();
    const p = await createPerformer(db, { displayName: "Existing", contactId: existing!.id });
    expect(p.contactId).toBe(existing!.id);
    const all = await db.select().from(performers).where(eq(performers.id, p.id));
    expect(all).toHaveLength(1);
  });
});
