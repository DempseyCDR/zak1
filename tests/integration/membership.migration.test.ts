import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import {
  contacts,
  membershipAccounts,
  membershipMembers,
  memberships,
  payers,
} from "@/server/db/schema";
import { contactRow } from "./helpers/factories";
import { migrateToAccounts } from "@/server/domain/membership/migrateToAccounts";

beforeAll(ensureSchema);
beforeEach(resetDb);
afterAll(closeDb);

/**
 * Feature 068 (FR-016, FR-021): moving the club's real memberships onto the account model.
 *
 * This seeds the OLD shape and proves nothing is lost. It depends on `memberships`/`payers` still
 * existing, which is exactly why the drop is deferred to a follow-up (research R9) — shipping it in this
 * feature would end by deleting the guard on its riskiest work.
 *
 * Measured inputs it stands in for: 154 rows over 115 payer groups, 152 distinct member contacts, 31
 * multi-member groups, ZERO level or expiry conflicts, and 17 payers with no contact of their own.
 */
describe("migrating memberships to accounts (feature 068)", () => {
  const contact = async (name: string) =>
    (await db.insert(contacts).values(contactRow(name)).returning())[0]!.id;

  async function legacyGroup(opts: {
    payerName: string;
    payerContactId: string | null;
    members: string[];
    level?: "individual" | "family" | "supporter" | "student";
    expiry?: string;
  }) {
    const [payer] = await db
      .insert(payers)
      .values({ name: opts.payerName, contactId: opts.payerContactId })
      .returning();
    for (const contactId of opts.members) {
      await db.insert(memberships).values({
        contactId,
        payerId: payer!.id,
        expiryDate: opts.expiry ?? "2026-08-31",
        level: opts.level ?? "individual",
      });
    }
    return payer!.id;
  }

  it("collapses a multi-member payer group into ONE account covering everyone (FR-016)", async () => {
    // The Culbert shape: one payer, four people, one level, one expiry.
    const cindy = await contact("Cindy Culbert");
    const rich = await contact("Rich Culbert");
    const abby = await contact("Abigail Culbert");
    const lydia = await contact("Lydia Culbert");
    await legacyGroup({
      payerName: "Cindy Culbert",
      payerContactId: cindy,
      members: [cindy, rich, abby, lydia],
      level: "supporter",
      expiry: "2026-09-01",
    });

    await migrateToAccounts(db);

    const accounts = await db.select().from(membershipAccounts);
    expect(accounts).toHaveLength(1);
    expect(accounts[0]!.level).toBe("supporter");
    expect(accounts[0]!.expiryDate).toBe("2026-09-01");
    expect(accounts[0]!.payerContactId).toBe(cindy);

    const members = await db
      .select({ contactId: membershipMembers.contactId })
      .from(membershipMembers)
      .where(eq(membershipMembers.accountId, accounts[0]!.id));
    expect(members.map((m) => m.contactId).sort()).toEqual([cindy, rich, abby, lydia].sort());
  });

  it("takes the LATEST expiry when a contact has renewed (FR-016)", async () => {
    const solo = await contact("Renewed Solo");
    const [payer] = await db
      .insert(payers)
      .values({ name: "Renewed Solo", contactId: solo })
      .returning();
    await db
      .insert(memberships)
      .values({ contactId: solo, payerId: payer!.id, expiryDate: "2025-08-31" });
    await db
      .insert(memberships)
      .values({ contactId: solo, payerId: payer!.id, expiryDate: "2026-08-31" });

    await migrateToAccounts(db);
    const [account] = await db.select().from(membershipAccounts);
    expect(account!.expiryDate).toBe("2026-08-31");
  });

  it("keeps a payer who is NOT the member as the owner (FR-001)", async () => {
    const payerContact = await contact("Paying Parent");
    const child = await contact("Covered Child");
    await legacyGroup({
      payerName: "Paying Parent",
      payerContactId: payerContact,
      members: [child],
      level: "family",
    });

    await migrateToAccounts(db);
    const [account] = await db.select().from(membershipAccounts);
    expect(account!.payerContactId).toBe(payerContact);
    // The payer is a member of their own account, even though the legacy rows did not say so (FR-007).
    const members = await db.select().from(membershipMembers);
    expect(members.map((m) => m.contactId).sort()).toEqual([payerContact, child].sort());
  });

  it("matches a contact-less payer to an existing contact by name (FR-021)", async () => {
    const existing = await contact("Charles Rosenberg");
    const other = await contact("Covered Person");
    await legacyGroup({ payerName: "Charles Rosenberg", payerContactId: null, members: [other] });

    const report = await migrateToAccounts(db);
    const [account] = await db.select().from(membershipAccounts);
    expect(account!.payerContactId).toBe(existing);
    expect(report.contactsCreated).toBe(0);
  });

  it("creates a contact for an unmatched payer and FLAGS it for review (FR-021, SC-007)", async () => {
    const other = await contact("Covered Person");
    await legacyGroup({ payerName: "Katherine Jorgensen", payerContactId: null, members: [other] });

    const report = await migrateToAccounts(db);
    expect(report.contactsCreated).toBe(1);

    const [account] = await db.select().from(membershipAccounts);
    const owner = await db.query.contacts.findFirst({
      where: eq(contacts.id, account!.payerContactId),
    });
    expect(owner!.displayName).toBe("Katherine Jorgensen");
    // Created, not silently — a human must see it (SC-007).
    expect(owner!.needsReview).toBe(true);
  });

  it("leaves NO account without a contact as owner (SC-007)", async () => {
    const a = await contact("Member A");
    await legacyGroup({ payerName: "Ghost Payer", payerContactId: null, members: [a] });
    await migrateToAccounts(db);

    const accounts = await db.select().from(membershipAccounts);
    expect(accounts.length).toBeGreaterThan(0);
    for (const acct of accounts) {
      const owner = await db.query.contacts.findFirst({
        where: eq(contacts.id, acct.payerContactId),
      });
      expect(owner).toBeDefined();
    }
  });

  it("ignores payers with no memberships at all", async () => {
    await db.insert(payers).values({ name: "Self", contactId: null });
    await migrateToAccounts(db);
    expect(await db.select().from(membershipAccounts)).toHaveLength(0);
  });

  it("is safe to run twice", async () => {
    const solo = await contact("Twice Run");
    await legacyGroup({ payerName: "Twice Run", payerContactId: solo, members: [solo] });

    await migrateToAccounts(db);
    const first = await db.select().from(membershipAccounts);
    await migrateToAccounts(db);
    const second = await db.select().from(membershipAccounts);

    expect(second).toHaveLength(first.length);
    expect(await db.select().from(membershipMembers)).toHaveLength(1);
  });
});
