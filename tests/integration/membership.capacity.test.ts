import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { contacts, membershipAccounts, membershipMembers } from "@/server/db/schema";
import { contactRow } from "./helpers/factories";
import {
  attachMember,
  changeLevel,
  detachMember,
  recordDuesPayment,
} from "@/server/domain/membership/accountService";

beforeAll(ensureSchema);
beforeEach(resetDb);
afterAll(closeDb);

/**
 * Feature 068 (FR-003a): the level caps who the account may cover.
 *
 * Individual and student admit the payer alone; family and supporter may cover others. Verified against
 * the club's real data before it was specified — 58 individual and 7 student accounts, every one solo, so
 * this codifies a rule the club already follows rather than imposing a new one.
 */
describe("level capacity (feature 068)", () => {
  const contact = async (name: string) =>
    (await db.insert(contacts).values(contactRow(name)).returning())[0]!.id;

  async function accountAt(level: "individual" | "family" | "supporter" | "student", name: string) {
    const payer = await contact(name);
    await recordDuesPayment(db, payer, { level, paymentDate: "2026-09-04" }, null);
    const acct = await db.query.membershipAccounts.findFirst({
      where: eq(membershipAccounts.payerContactId, payer),
    });
    return { payer, accountId: acct!.id };
  }

  const memberCount = async (accountId: string) =>
    (await db.select().from(membershipMembers).where(eq(membershipMembers.accountId, accountId)))
      .length;

  it("family admits another member (FR-003a)", async () => {
    const { payer } = await accountAt("family", "Fam Payer");
    const spouse = await contact("Fam Spouse");
    await attachMember(db, payer, spouse, null);
    expect((await contactsOn(payer)).sort()).toEqual([payer, spouse].sort());
  });

  it("supporter admits another member (FR-003a)", async () => {
    const { payer } = await accountAt("supporter", "Sup Payer");
    const child = await contact("Sup Child");
    await attachMember(db, payer, child, null);
    expect(await contactsOn(payer)).toHaveLength(2);
  });

  it("individual admits nobody but the payer (FR-003a)", async () => {
    const { payer } = await accountAt("individual", "Ind Payer");
    const other = await contact("Ind Other");
    await expect(attachMember(db, payer, other, null)).rejects.toMatchObject({
      code: "LEVEL_ADMITS_NO_MEMBERS",
    });
  });

  it("student admits nobody but the payer (FR-003a)", async () => {
    const { payer } = await accountAt("student", "Stu Payer");
    const other = await contact("Stu Other");
    await expect(attachMember(db, payer, other, null)).rejects.toMatchObject({
      code: "LEVEL_ADMITS_NO_MEMBERS",
    });
  });

  it("lowering the level is refused, NAMING who would be displaced (FR-023)", async () => {
    const { payer } = await accountAt("family", "Down Payer");
    const spouse = await contact("Displaced Spouse");
    const kid = await contact("Displaced Kid");
    await attachMember(db, payer, spouse, null);
    await attachMember(db, payer, kid, null);

    await expect(changeLevel(db, payer, "individual", null)).rejects.toMatchObject({
      code: "LEVEL_CAPACITY_EXCEEDED",
    });
    // The refusal must say WHO — a count leaves the FS guessing.
    await changeLevel(db, payer, "individual", null).catch((e: { message: string }) => {
      expect(e.message).toMatch(/Displaced Spouse/);
      expect(e.message).toMatch(/Displaced Kid/);
    });
  });

  it("lowering the level is allowed once the others are removed (FR-023)", async () => {
    const { payer } = await accountAt("family", "Shrink Payer");
    const spouse = await contact("Leaving Spouse");
    await attachMember(db, payer, spouse, null);
    await detachMember(db, payer, spouse, null);
    await changeLevel(db, payer, "individual", null);

    const acct = await db.query.membershipAccounts.findFirst({
      where: eq(membershipAccounts.payerContactId, payer),
    });
    expect(acct!.level).toBe("individual");
  });

  it("a renewal that lowers the level is refused the same way (FR-024 × FR-003a)", async () => {
    const { payer } = await accountAt("family", "Renew Payer");
    const spouse = await contact("Renew Spouse");
    await attachMember(db, payer, spouse, null);

    // The household shrinking at renewal must not silently un-member anyone.
    await expect(
      recordDuesPayment(db, payer, { level: "individual", paymentDate: "2027-09-04" }, null),
    ).rejects.toMatchObject({ code: "LEVEL_CAPACITY_EXCEEDED" });
  });

  it("the payer cannot be detached from their own account (FR-007/FR-009)", async () => {
    const { payer } = await accountAt("family", "Owner Payer");
    await expect(detachMember(db, payer, payer, null)).rejects.toMatchObject({
      code: "PAYER_NOT_DETACHABLE",
    });
  });

  it("attaching twice is idempotent; detaching a non-member is a no-op", async () => {
    const { payer, accountId } = await accountAt("family", "Idem Payer");
    const other = await contact("Idem Other");
    await attachMember(db, payer, other, null);
    await attachMember(db, payer, other, null);
    expect(await memberCount(accountId)).toBe(2);

    const stranger = await contact("Idem Stranger");
    await detachMember(db, payer, stranger, null);
    expect(await memberCount(accountId)).toBe(2);
  });

  async function contactsOn(payerContactId: string): Promise<string[]> {
    const acct = await db.query.membershipAccounts.findFirst({
      where: eq(membershipAccounts.payerContactId, payerContactId),
    });
    const rows = await db
      .select({ contactId: membershipMembers.contactId })
      .from(membershipMembers)
      .where(eq(membershipMembers.accountId, acct!.id));
    return rows.map((r) => r.contactId);
  }
});
