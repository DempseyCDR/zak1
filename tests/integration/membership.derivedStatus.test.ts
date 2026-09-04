import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { contacts, membershipAccounts, membershipMembers } from "@/server/db/schema";
import { contactRow } from "./helpers/factories";
import { contactMembership } from "@/server/domain/membership/membershipStatus";

beforeAll(ensureSchema);
beforeEach(resetDb);
afterAll(closeDb);

/**
 * Feature 068 (FR-010, FR-011, FR-013, FR-015): the derivation is the load-bearing idea.
 *
 * Status is a function of the covering accounts and TODAY — not of a stored column that was written the
 * last time someone happened to edit a contact. That distinction is the whole point: on 1 September 2026
 * the club's year rolled and 118 memberships became lapsed while every stored status still read `current`.
 */
describe("contact membership derivation (feature 068)", () => {
  const today = () => new Date().toISOString().slice(0, 10);
  const shift = (days: number) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };

  async function contact(name: string) {
    const [c] = await db.insert(contacts).values(contactRow(name)).returning();
    return c!.id;
  }

  async function account(payerId: string, level: string, expiry: string, members: string[] = []) {
    const [a] = await db
      .insert(membershipAccounts)
      .values({ payerContactId: payerId, level: level as "family", expiryDate: expiry })
      .returning();
    await db
      .insert(membershipMembers)
      .values([payerId, ...members].map((contactId) => ({ accountId: a!.id, contactId })));
    return a!.id;
  }

  it("a contact on no account is `never` and not a member (FR-011)", async () => {
    const id = await contact("No Account");
    const m = await contactMembership(db, id);
    expect(m.status).toBe("never");
    expect(m.isMember).toBe(false);
    expect(m.level).toBeNull();
  });

  it("an attached member is current while the account is valid (FR-010, FR-011)", async () => {
    const payer = await contact("Cindy Culbert");
    const member = await contact("Abigail Culbert");
    await account(payer, "supporter", shift(30), [member]);

    const m = await contactMembership(db, member);
    expect(m.status).toBe("current");
    expect(m.isMember).toBe(true);
  });

  it("level belongs to the payer — a member who pays for nothing has none (FR-013)", async () => {
    const payer = await contact("Cindy Culbert");
    const member = await contact("Abigail Culbert");
    await account(payer, "supporter", shift(30), [member]);

    expect((await contactMembership(db, payer)).level).toBe("supporter");
    expect((await contactMembership(db, member)).level).toBeNull();
  });

  it("the MOST GENEROUS covering account decides status (FR-010)", async () => {
    const householdPayer = await contact("Parent Payer");
    const lydia = await contact("Lydia Dempsey");
    await account(householdPayer, "family", shift(-10), [lydia]); // lapsed household
    await account(lydia, "student", shift(60)); // her own, still valid

    const m = await contactMembership(db, lydia);
    expect(m.status).toBe("current");
    // Her own account's level is hers; the household's is not.
    expect(m.level).toBe("student");
  });

  it("a lapsed member is still a member, so a reminder can reach them (FR-012)", async () => {
    const payer = await contact("Lapsed Payer");
    await account(payer, "individual", shift(-30));

    const m = await contactMembership(db, payer);
    expect(m.status).toBe("lapsed");
    expect(m.isMember).toBe(true);
  });

  it("a boundary passing changes the answer with NO write (FR-015, SC-005)", async () => {
    const payer = await contact("Rollover Payer");
    // Expired yesterday: exactly the 1 September case, with nothing having touched the contact since.
    await account(payer, "individual", shift(-1));

    expect((await contactMembership(db, payer)).status).toBe("lapsed");
    // The stored cache still says what it said before the boundary passed…
    const stored = await db.query.contacts.findFirst({ where: eq(contacts.id, payer) });
    expect(stored!.membershipStatus).toBe("never"); // never written by this test
    // …and the derivation does not care.
    expect((await contactMembership(db, payer)).status).toBe("lapsed");
  });

  it("a deliberately WRONG stored column is ignored (FR-015)", async () => {
    const payer = await contact("Stale Cache");
    await account(payer, "family", shift(-5));
    await db
      .update(contacts)
      .set({ membershipStatus: "current", listMember: true })
      .where(eq(contacts.id, payer));

    expect((await contactMembership(db, payer)).status).toBe("lapsed");
  });

  it("expiry today is still current — the boundary is inclusive", async () => {
    const payer = await contact("Boundary Payer");
    await account(payer, "individual", today());
    expect((await contactMembership(db, payer)).status).toBe("current");
  });
});
