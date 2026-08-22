import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { icontactCsv, memberCsv, payerCsv } from "./helpers/contactLoadCsv";
import { contactEmails, contacts, memberships, payers } from "@/server/db/schema";
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
async function membershipFor(contactId: string) {
  const [m] = await db.select().from(memberships).where(eq(memberships.contactId, contactId));
  return m!;
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

    // Family payer shared across two members, same expiry + level.
    expect(await membershipFor(alene.id)).toMatchObject({
      level: "family",
      expiryDate: "2030-09-01",
    });
    expect(await membershipFor(charles.id)).toMatchObject({
      level: "family",
      expiryDate: "2030-09-01",
    });
    expect(await membershipFor(tim.id)).toMatchObject({ level: "individual" });

    // Status recomputed from expiry (future → current; long-past → not current).
    expect(alene.membershipStatus).toBe("current");
    expect(tim.membershipStatus).not.toBe("current");

    // Payer→contact link = the paying member (FR-020): "Alene Boyar" matches Alene's dedup key.
    const [aBoyar] = await db.select().from(payers).where(eq(payers.name, "Alene Boyar"));
    expect(aBoyar!.contactId).toBe(alene.id);

    expect(counts.membershipsByLevel).toMatchObject({ family: 2, individual: 1 });
  });

  it("loads a member without a membership when the payer expiry is blank", async () => {
    await run(
      [{ first: "No", last: "Expiry", payer: "N Exp", email: "noexp@x.com" }],
      [{ id: "N Exp", name: "No Expiry", expires: "", level: "Individual" }],
    );
    const c = await contactByEmail("noexp@x.com");
    const rows = await db.select().from(memberships).where(eq(memberships.contactId, c.id));
    expect(rows).toHaveLength(0);
    expect(c.membershipStatus).toBe("never");
  });
});
