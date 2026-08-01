import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { contactRow, makeContactWithEmail } from "./helpers/factories";
import { contacts } from "@/server/db/schema";
import { createPerformer } from "@/server/domain/performers/performerService";
import { performerCreateSchema } from "@/server/validation/performers";

// Feature 026 (R5-P1): performer creation captures structured first/last/display, so the auto-created contact
// is indistinguishable from a door/directory contact (no full name jammed into first_name).
describe("structured name capture on performer creation", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("stores first and last separately and derives the display name", async () => {
    const p = await createPerformer(db, { firstName: "Chuck", lastName: "Abell" });
    const contact = await db.query.contacts.findFirst({ where: eq(contacts.id, p.contactId!) });
    expect(contact?.firstName).toBe("Chuck");
    expect(contact?.lastName).toBe("Abell");
    expect(contact?.displayName).toBe("Chuck Abell");
    expect(p.displayName).toBe("Chuck Abell"); // performer display derived, matches the contact
  });

  it("accepts a mononym (last name omitted) without blocking", async () => {
    const p = await createPerformer(db, { firstName: "Fiddlehead" });
    const contact = await db.query.contacts.findFirst({ where: eq(contacts.id, p.contactId!) });
    expect(contact?.firstName).toBe("Fiddlehead");
    expect(contact?.lastName).toBeNull();
    expect(contact?.displayName).toBe("Fiddlehead");
  });

  it("keeps structured first/last while showing a display override; dedup ignores the override", async () => {
    const p = await createPerformer(db, {
      firstName: "Charles",
      lastName: "Abell",
      displayNameOverride: "Chuck Abell",
    });
    const contact = await db.query.contacts.findFirst({ where: eq(contacts.id, p.contactId!) });
    expect(contact?.firstName).toBe("Charles");
    expect(contact?.lastName).toBe("Abell");
    expect(contact?.displayName).toBe("Chuck Abell"); // override shows
    expect(contact?.dedupNormalized).toBe("charles abell"); // dedup key from structured name, not the override
  });

  it("links an existing contact without creating one; performer display comes from the contact", async () => {
    const { contactId } = await makeContactWithEmail({
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@ex.com",
    });
    const before = await db.select().from(contacts);
    const p = await createPerformer(db, { contactId });
    const after = await db.select().from(contacts);

    expect(after.length).toBe(before.length); // no new contact
    expect(p.contactId).toBe(contactId);
    const linked = await db.query.contacts.findFirst({ where: eq(contacts.id, contactId) });
    expect(p.displayName).toBe(linked?.displayName); // "Ada Lovelace"
  });

  it("rejects input with neither a contactId nor a firstName", () => {
    expect(performerCreateSchema.safeParse({ email: "x@ex.com" }).success).toBe(false);
    // ...and rejects both together (ambiguous link-vs-create).
    expect(
      performerCreateSchema.safeParse({ contactId: crypto.randomUUID(), firstName: "X" }).success,
    ).toBe(false);
  });

  it("does not modify any pre-existing contact (FR-007 guard — analyze V1)", async () => {
    const [prior] = await db.insert(contacts).values(contactRow("Pat Prior")).returning();
    await createPerformer(db, { firstName: "New", lastName: "Performer" });
    const after = await db.query.contacts.findFirst({ where: eq(contacts.id, prior!.id) });
    expect(after?.firstName).toBe(prior!.firstName);
    expect(after?.lastName).toBe(prior!.lastName);
    expect(after?.displayName).toBe(prior!.displayName);
  });
});
