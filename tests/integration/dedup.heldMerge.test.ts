import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { contactEmails, contacts, heldMerges, membershipAccounts } from "@/server/db/schema";
import {
  contactRow,
  makeActor,
  makeContactWithEmail,
  makeMembershipAccount,
} from "./helpers/factories";
import { mergeContacts } from "@/server/domain/dedup/mergeService";
import { listHeldMerges, resolveHeldMerge } from "@/server/domain/dedup/heldMergeService";
import { getMergeSuggestions } from "@/server/domain/dedup/suggestionService";
import { listNeedsReview } from "@/server/domain/contacts/contactService";

beforeAll(ensureSchema);
beforeEach(resetDb);
afterAll(closeDb);

const contact = async (name: string) =>
  (await db.insert(contacts).values(contactRow(name)).returning())[0]!.id;

async function withLogin(firstName: string, email: string) {
  const c = await makeContactWithEmail({ firstName, lastName: "Vale", email });
  await db.update(contactEmails).set({ isLogin: true }).where(eq(contactEmails.id, c.emailId));
  return c;
}

/**
 * Feature 069, US4 (M-R21). Two collisions can make a merge impossible to complete silently: two sign-in
 * identities (one login per contact) and two membership accounts (one account per payer). Until now both
 * surfaced as a raw Postgres unique-violation. Neither is a data error — each is a real question with a
 * right answer that a person has to give, and for a sign-in that person is not necessarily the one
 * working the queue.
 */
describe("a merge that cannot complete is HELD, not failed", () => {
  it("holds two sign-in identities, changing nothing", async () => {
    const a = await withLogin("Terry", "terry@example.com");
    const b = await withLogin("Terri", "terri@example.com");
    const actor = await contact("Mel Actor");

    const result = await mergeContacts(db, a.contactId, b.contactId, actor);
    expect(result.outcome).toBe("held");
    if (result.outcome !== "held") throw new Error("expected held");
    if (result.reason !== "two_logins") throw new Error("expected two_logins");
    expect(result.candidates.map((c) => c.email).sort()).toEqual([
      "terri@example.com",
      "terry@example.com",
    ]);

    // Nothing moved and nobody was retired.
    const merged = await db.query.contacts.findFirst({ where: eq(contacts.id, b.contactId) });
    expect(merged?.mergedIntoId).toBeNull();
    const emails = await db
      .select()
      .from(contactEmails)
      .where(eq(contactEmails.contactId, b.contactId));
    expect(emails).toHaveLength(1);
  });

  it("holds two membership accounts the same way", async () => {
    const a = await contact("Pat Payer");
    const b = await contact("Patricia Payer");
    const actor = await contact("Mel Actor");
    await makeMembershipAccount({ payerContactId: a, level: "family", expiryDate: "2099-08-31" });
    await makeMembershipAccount({
      payerContactId: b,
      level: "individual",
      expiryDate: "2098-08-31",
    });

    const result = await mergeContacts(db, a, b, actor);
    if (result.outcome !== "held") throw new Error("expected held");
    expect(result.reason).toBe("two_accounts");
    expect(result.candidates).toHaveLength(2);
    expect(await db.select().from(membershipAccounts)).toHaveLength(2);
  });

  it("records the hold as its own item, naming both contacts and the reason (FR-014)", async () => {
    const a = await withLogin("Terry", "terry@example.com");
    const b = await withLogin("Terri", "terri@example.com");
    const actor = await contact("Mel Actor");
    await mergeContacts(db, a.contactId, b.contactId, actor);

    const held = await listHeldMerges(db);
    expect(held).toHaveLength(1);
    expect(held[0]!.reason).toBe("two_logins");
    expect([held[0]!.canonicalDisplayName, held[0]!.mergedDisplayName].sort()).toEqual([
      "Terri Vale",
      "Terry Vale",
    ]);
  });

  it("raises one hold per pair, however many times the merge is retried", async () => {
    const a = await withLogin("Terry", "terry@example.com");
    const b = await withLogin("Terri", "terri@example.com");
    const actor = await contact("Mel Actor");
    await mergeContacts(db, a.contactId, b.contactId, actor);
    await mergeContacts(db, a.contactId, b.contactId, actor);
    expect(await listHeldMerges(db)).toHaveLength(1);
  });

  it("resolving the sign-in choice completes the merge", async () => {
    const a = await withLogin("Terry", "terry@example.com");
    const b = await withLogin("Terri", "terri@example.com");
    const actor = await contact("Mel Actor");
    const held = await mergeContacts(db, a.contactId, b.contactId, actor);
    if (held.outcome !== "held") throw new Error("expected held");

    const out = await resolveHeldMerge(
      db,
      held.heldMergeId,
      { survivingLoginEmailId: a.emailId },
      actor,
    );
    expect(out.outcome).toBe("completed");

    const merged = await db.query.contacts.findFirst({ where: eq(contacts.id, b.contactId) });
    expect(merged?.mergedIntoId).toBe(a.contactId);
    // Both addresses survive on the survivor; exactly one of them signs in, and it is the chosen one.
    const emails = await db
      .select()
      .from(contactEmails)
      .where(eq(contactEmails.contactId, a.contactId));
    expect(emails).toHaveLength(2);
    expect(emails.filter((e) => e.isLogin).map((e) => e.id)).toEqual([a.emailId]);
    // The hold is closed, not left open beside a merge that already happened.
    expect(await listHeldMerges(db)).toHaveLength(0);
  });

  it("resolving the account choice folds the losing household into the survivor's account", async () => {
    const a = await contact("Pat Payer");
    const b = await contact("Patricia Payer");
    const rider = await contact("Household Rider");
    const actor = await contact("Mel Actor");
    const keep = await makeMembershipAccount({
      payerContactId: a,
      level: "family",
      expiryDate: "2099-08-31",
    });
    await makeMembershipAccount({
      payerContactId: b,
      level: "individual",
      expiryDate: "2098-08-31",
      members: [rider],
    });

    const held = await mergeContacts(db, a, b, actor);
    if (held.outcome !== "held") throw new Error("expected held");
    const out = await resolveHeldMerge(
      db,
      held.heldMergeId,
      { survivingAccountId: keep.accountId },
      actor,
    );
    expect(out.outcome).toBe("completed");

    const accounts = await db.select().from(membershipAccounts);
    expect(accounts).toHaveLength(1);
    expect(accounts[0]!.id).toBe(keep.accountId);
    expect(accounts[0]!.payerContactId).toBe(a);
    // Nobody loses their membership because the account they were on was the one not kept.
    const covered = await db.query.membershipMembers.findMany();
    expect(covered.map((m) => m.contactId)).toContain(rider);
  });

  it("refuses a choice that does not resolve the reason it was held for", async () => {
    const a = await withLogin("Terry", "terry@example.com");
    const b = await withLogin("Terri", "terri@example.com");
    const actor = await contact("Mel Actor");
    const held = await mergeContacts(db, a.contactId, b.contactId, actor);
    if (held.outcome !== "held") throw new Error("expected held");

    await expect(
      resolveHeldMerge(db, held.heldMergeId, { survivingAccountId: crypto.randomUUID() }, actor),
    ).rejects.toMatchObject({ code: "HELD_MERGE_REASON_MISMATCH" });
  });

  it("closes a hold whose cause has gone, without merging", async () => {
    const a = await withLogin("Terry", "terry@example.com");
    const b = await withLogin("Terri", "terri@example.com");
    const actor = await contact("Mel Actor");
    await mergeContacts(db, a.contactId, b.contactId, actor);

    // The duplicate is archived instead — the question the hold asked no longer arises.
    await db.update(contacts).set({ archivedAt: new Date() }).where(eq(contacts.id, b.contactId));
    expect(await listHeldMerges(db)).toHaveLength(0);
    expect((await db.select().from(heldMerges)).every((h) => h.resolvedAt !== null)).toBe(true);
  });

  it("keeps a review flag and a held merge independent of each other (FR-014a)", async () => {
    const a = await withLogin("Terry", "terry@example.com");
    const b = await withLogin("Terri", "terri@example.com");
    const actor = await contact("Mel Actor");
    await db.update(contacts).set({ needsReview: true }).where(eq(contacts.id, a.contactId));
    const held = await mergeContacts(db, a.contactId, b.contactId, actor);
    if (held.outcome !== "held") throw new Error("expected held");

    // Resolving the hold merges the pair; the survivor's own review flag is untouched.
    await resolveHeldMerge(db, held.heldMergeId, { survivingLoginEmailId: a.emailId }, actor);
    const survivor = await db.query.contacts.findFirst({ where: eq(contacts.id, a.contactId) });
    expect(survivor?.needsReview).toBe(true);
  });

  it("a contact in BOTH queues keeps the other task when one is resolved (FR-016)", async () => {
    const a = await makeContactWithEmail({
      firstName: "Nora",
      lastName: "Quinn",
      email: "nora@example.com",
    });
    const b = await contact("Norah Quinn");
    const actor = await makeActor({ email: "mel@example.com", grants: [] });
    await db.update(contacts).set({ needsReview: true }).where(eq(contacts.id, a.contactId));

    expect((await listNeedsReview(db)).items.some((r) => r.id === a.contactId)).toBe(true);
    expect((await getMergeSuggestions(db)).length).toBe(1);

    // Clearing the review flag says nothing about whether these are the same person.
    await db.update(contacts).set({ needsReview: false }).where(eq(contacts.id, a.contactId));
    expect((await getMergeSuggestions(db)).length).toBe(1);

    // And rejecting the pair says nothing about whether the record is complete.
    await db.update(contacts).set({ needsReview: true }).where(eq(contacts.id, a.contactId));
    const { rejectPair } = await import("@/server/domain/dedup/rejectionService");
    await rejectPair(db, a.contactId, b, actor.contactId);
    expect((await getMergeSuggestions(db)).length).toBe(0);
    expect((await listNeedsReview(db)).items.some((r) => r.id === a.contactId)).toBe(true);
  });
});
