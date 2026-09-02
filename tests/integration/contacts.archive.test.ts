import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { contacts } from "@/server/db/schema";
import { contactRow, makeContactWithEmail } from "./helpers/factories";
import {
  archiveContact,
  countNeedsReview,
  listNeedsReview,
  restoreContact,
  searchContacts,
} from "@/server/domain/contacts/contactService";
import {
  countMergeSuggestions,
  getMergeSuggestions,
} from "@/server/domain/dedup/suggestionService";
import { buildListRows } from "@/server/domain/exports/exportService";

// File-level DB lifecycle (single closeDb for the shared pool).
beforeAll(ensureSchema);
beforeEach(resetDb);
afterAll(closeDb);

const names = (rows: { displayName: string }[]) => rows.map((r) => r.displayName).sort();

// Feature 065 (M-R9/M-R10): archiving hides a contact from every active read; restore brings it back.
describe("archive hides from active reads (feature 065)", () => {
  it("archived contact disappears from search, needs-review, dedup, counts (C1)", async () => {
    const [amy] = await db
      .insert(contacts)
      .values([{ ...contactRow("Amy Archer"), needsReview: true }])
      .returning();

    // Present while active.
    expect(names(await searchContacts(db, "amy").then((r) => r.items))).toEqual(["Amy Archer"]);
    expect(await countNeedsReview(db)).toBe(1);
    expect(names((await listNeedsReview(db)).items)).toEqual(["Amy Archer"]);

    await archiveContact(db, amy!.id);

    // Gone from every active read.
    expect((await searchContacts(db, "amy")).items).toEqual([]);
    expect(await countNeedsReview(db)).toBe(0);
    expect((await listNeedsReview(db)).items).toEqual([]);
  });

  it("archiving a duplicate removes the pair and drops the dedup count (C1)", async () => {
    await db.insert(contacts).values([contactRow("Jon Smith"), contactRow("John Smith")]);
    expect(await countMergeSuggestions(db)).toBeGreaterThanOrEqual(1);
    const [c065] = await db.insert(contacts).values(contactRow("Jon Smith")).returning();
    const id = c065!.id;
    await archiveContact(db, id);
    // Archiving one member of a pair reduces the candidate set.
    const before = await countMergeSuggestions(db);
    // Archive one of the original two as well → no remaining pair.
    const jon = await db.query.contacts.findFirst({
      where: eq(contacts.displayName, "John Smith"),
    });
    await archiveContact(db, jon!.id);
    expect(await countMergeSuggestions(db)).toBeLessThan(before);
    expect(await getMergeSuggestions(db)).not.toContainEqual(
      expect.objectContaining({ a: expect.objectContaining({ displayName: "John Smith" }) }),
    );
  });

  it("archived contact is excluded from mailing-list exports (C1)", async () => {
    const { contactId } = await makeContactWithEmail({
      firstName: "Mem",
      lastName: "Ber",
      email: "member@example.com",
      listMember: true,
      membershipStatus: "current",
      consentTopics: ["contra"],
    });
    const present = await buildListRows(db, "member");
    expect(present.some((r) => r.email === "member@example.com")).toBe(true);

    await archiveContact(db, contactId);
    const after = await buildListRows(db, "member");
    expect(after.some((r) => r.email === "member@example.com")).toBe(false);
  });

  it("include-archived surfaces archived rows marked with archivedAt (C3)", async () => {
    const [c065] = await db.insert(contacts).values(contactRow("Zed Archer")).returning();
    const id = c065!.id;
    await archiveContact(db, id);
    // Default excludes.
    expect((await searchContacts(db, "zed")).items).toEqual([]);
    // includeArchived returns it, carrying archivedAt.
    const withArchived = await searchContacts(db, "zed", 20, { includeArchived: true });
    expect(names(withArchived.items)).toEqual(["Zed Archer"]);
    expect(withArchived.items[0]!.archivedAt).not.toBeNull();
  });

  it("restore returns the contact to active reads (C2)", async () => {
    const [c065] = await db.insert(contacts).values(contactRow("Ren Back")).returning();
    const id = c065!.id;
    await archiveContact(db, id);
    expect((await searchContacts(db, "ren")).items).toEqual([]);
    await restoreContact(db, id);
    expect(names((await searchContacts(db, "ren")).items)).toEqual(["Ren Back"]);
    const row = await db.query.contacts.findFirst({ where: eq(contacts.id, id) });
    expect(row!.archivedAt).toBeNull();
    expect(row!.mergedIntoId).toBeNull(); // archive is distinct from merge (FR-005)
  });
});
