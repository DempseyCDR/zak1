import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { icontactCsv, memberCsv, payerCsv } from "./helpers/contactLoadCsv";
import { contactEmails, contacts, membershipAccounts, membershipMembers } from "@/server/db/schema";
import { parseIcontact } from "@/server/domain/contactLoad/parseIcontact";
import { parseMemberSheet } from "@/server/domain/contactLoad/parseMemberSheet";
import { parsePayerSheet } from "@/server/domain/contactLoad/parsePayerSheet";
import { executeContactLoad } from "@/server/domain/contactLoad/execute";
import type { MemberRowFixture, PayerRowFixture } from "./helpers/contactLoadCsv";

function run(members: MemberRowFixture[], payerRows: PayerRowFixture[]) {
  return executeContactLoad(
    db,
    {
      icontact: parseIcontact(icontactCsv([])),
      members: parseMemberSheet(memberCsv(members)),
      payers: parsePayerSheet(payerCsv(payerRows)),
    },
    { dryRun: false },
  );
}
async function contactByEmail(email: string) {
  const [e] = await db.select().from(contactEmails).where(eq(contactEmails.email, email));
  const [c] = await db.select().from(contacts).where(eq(contacts.id, e!.contactId));
  return c!;
}
/** Feature 068: the ACCOUNT covering a contact — one per household, not one row per person. */
async function accountCovering(contactId: string) {
  const [row] = await db
    .select({
      level: membershipAccounts.level,
      expiryDate: membershipAccounts.expiryDate,
      payerContactId: membershipAccounts.payerContactId,
    })
    .from(membershipMembers)
    .innerJoin(membershipAccounts, eq(membershipAccounts.id, membershipMembers.accountId))
    .where(eq(membershipMembers.contactId, contactId));
  return row;
}

describe("contact load — memberships & level (US3)", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("creates memberships with level, shares a family payer, links the paying member, and recomputes status", async () => {
    const { counts } = await run(
      [
        { first: "Alene", last: "Boyar", payer: "A Boyar", email: "alene@x.com" },
        { first: "Charles", last: "Boyar", payer: "A Boyar", email: "charles@x.com" },
        { first: "Tim", last: "Hunt", payer: "T Hunt", email: "tim@x.com" },
      ],
      [
        { id: "A Boyar", name: "Alene Boyar", expires: "9/1/2030", level: "Family" },
        { id: "T Hunt", name: "Tim Hunt", expires: "9/1/2020", level: "Individual" },
      ],
    );

    const alene = await contactByEmail("alene@x.com");
    const charles = await contactByEmail("charles@x.com");
    const tim = await contactByEmail("tim@x.com");

    // Family payer shared across two members: ONE account covering both, at one level and expiry.
    expect(await accountCovering(alene.id)).toMatchObject({
      level: "family",
      expiryDate: "2030-09-01",
    });
    expect(await accountCovering(charles.id)).toMatchObject({
      level: "family",
      expiryDate: "2030-09-01",
    });
    expect(await accountCovering(tim.id)).toMatchObject({ level: "individual" });
    // Two members, one household → one account, not two.
    expect(await db.select().from(membershipAccounts)).toHaveLength(2);

    // Status recomputed from expiry (future → current; long-past → not current).
    expect(alene.membershipStatus).toBe("current");
    expect(tim.membershipStatus).not.toBe("current");

    // The account is OWNED by the paying member (FR-020/FR-001): "Alene Boyar" matches Alene's dedup key.
    expect((await accountCovering(charles.id))!.payerContactId).toBe(alene.id);

    expect(counts.membershipsByLevel).toMatchObject({ family: 2, individual: 1 });
  });

  it("loads a member without a membership when the payer expiry is blank", async () => {
    await run(
      [{ first: "No", last: "Expiry", payer: "N Exp", email: "noexp@x.com" }],
      [{ id: "N Exp", name: "No Expiry", expires: "", level: "Individual" }],
    );
    const c = await contactByEmail("noexp@x.com");
    expect(await accountCovering(c.id)).toBeUndefined();
    expect(c.membershipStatus).toBe("never");
  });
});
