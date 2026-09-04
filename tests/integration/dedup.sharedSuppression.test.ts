import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { contacts } from "@/server/db/schema";
import { contactRow, makeContactWithEmail } from "./helpers/factories";
import { getMergeSuggestions } from "@/server/domain/dedup/suggestionService";
import { linkMessageRecipient } from "@/server/domain/contacts/referenceService";

beforeAll(ensureSchema);
beforeEach(resetDb);
afterAll(closeDb);

const pairNames = (rows: { a: { displayName: string }; b: { displayName: string } }[]) =>
  rows.map((r) => [r.a.displayName, r.b.displayName].sort().join(" | "));

/**
 * Feature 067 (FR-018): a pair already linked as shared is not offered as a duplicate.
 *
 * Suggestions pair on NAME similarity (`dedup_normalized`) at a 0.4 trigram threshold — never on email.
 * MEASURED: differing first names dominate, so "David Jones"/"Bridgit Jones" scores 0.30 and
 * "Lydia Dempsey"/"Richard Dempsey" 0.36 — neither reaches the queue at all. The pairs that DO reach it
 * are near-identical names ("Robert Jones"/"Rob Jones" = 0.64): a father and son at one address, or a
 * couple entered inconsistently. Those are exactly the pairs Mel resolves as a share rather than a
 * merge, and without suppression they return on every pass.
 */
describe("linked households drop out of duplicate suggestions (feature 067)", () => {
  /** A pair that genuinely reaches the queue (0.64), unlike differing first names. */
  async function suggestedPair() {
    const owner = await makeContactWithEmail({
      firstName: "Robert",
      lastName: "Jones",
      email: "shared@jones.com",
    });
    const [rob] = await db.insert(contacts).values(contactRow("Rob Jones")).returning();
    return { ownerId: owner.contactId, emailId: owner.emailId, referrerId: rob!.id };
  }

  it("suggests the pair BEFORE linking (control)", async () => {
    await suggestedPair();
    expect(pairNames(await getMergeSuggestions(db)).length).toBeGreaterThanOrEqual(1);
  });

  it("suppresses the pair once the referrer points at the owner's email (FR-018)", async () => {
    const { emailId, referrerId } = await suggestedPair();
    await linkMessageRecipient(db, referrerId, { emailId }, null);
    expect(pairNames(await getMergeSuggestions(db))).toEqual([]);
  });

  it("suppression covers the pair whichever side owns the address (FR-018)", async () => {
    // Owner created second, so the pointer runs opposite to the `a.id < b.id` ordering the query uses.
    const rob = await makeContactWithEmail({
      firstName: "Rob",
      lastName: "Jones",
      email: "shared@jones.com",
    });
    const [robert] = await db.insert(contacts).values(contactRow("Robert Jones")).returning();
    expect(pairNames(await getMergeSuggestions(db)).length).toBeGreaterThanOrEqual(1);
    await linkMessageRecipient(db, robert!.id, { emailId: rob.emailId }, null);
    expect(pairNames(await getMergeSuggestions(db))).toEqual([]);
  });

  it("an UNLINKED similar pair keeps being suggested — only linked pairs are suppressed", async () => {
    await db.insert(contacts).values([contactRow("Chris Jones"), contactRow("Cris Jones")]);
    expect(pairNames(await getMergeSuggestions(db)).length).toBeGreaterThanOrEqual(1);
  });

  it("same surname + different first names never reaches the queue at all (FR-019 context)", async () => {
    // Lydia and Richard Dempsey share a surname but not a household. At 0.36 they fall under the 0.4
    // threshold, so they are never offered as a pair — and so can never be mislinked from that queue.
    await db.insert(contacts).values([contactRow("Lydia Dempsey"), contactRow("Richard Dempsey")]);
    expect(pairNames(await getMergeSuggestions(db))).toEqual([]);
  });
});
