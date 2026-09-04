import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { contacts } from "@/server/db/schema";
import { contactRow, makeBaseActor } from "./helpers/factories";
import { jsonReq, jsonReqAs, ctx } from "./helpers/http";
import { GET as GET_CONTACT } from "@/app/api/contacts/[id]/route";
import { attachMember, recordDuesPayment } from "@/server/domain/membership/accountService";

beforeAll(ensureSchema);
beforeEach(resetDb);
afterAll(closeDb);

/**
 * Feature 068 (FR-018/FR-019): the household is answerable from the record itself — who paid for this
 * person, and who does this payment cover.
 */
describe("membership on the contact record (feature 068)", () => {
  const contact = async (name: string) =>
    (await db.insert(contacts).values(contactRow(name)).returning())[0]!.id;

  async function household() {
    const payer = await contact("Cindy Culbert");
    const member = await contact("Abigail Culbert");
    await recordDuesPayment(db, payer, { level: "supporter", paymentDate: "2026-09-04" }, null);
    await attachMember(db, payer, member, null);
    return { payer, member };
  }

  const read = (id: string) => GET_CONTACT(jsonReq("GET", `/api/contacts/${id}`), ctx({ id }));

  it("a member's record names the payer (FR-018)", async () => {
    const { payer, member } = await household();
    const body = await (await read(member)).json();
    expect(body.membership.asMember).toMatchObject({
      payerContactId: payer,
      payerDisplayName: "Cindy Culbert",
    });
    // Level is the payer's, so a member who pays for nothing shows none (FR-013).
    expect(body.membership.asPayer).toBeNull();
  });

  it("a payer's record lists the other members (FR-019)", async () => {
    const { member } = await household();
    const payerBody = await (await read((await household()).payer)).json();
    expect(payerBody.membership.asPayer.level).toBe("supporter");
    expect(Array.isArray(payerBody.membership.asPayer.members)).toBe(true);
    // And the first household's member is on its own account, unaffected.
    expect(member).toBeTruthy();
  });

  it("a contact who both pays and is covered shows both sides", async () => {
    const householdPayer = await contact("Parent Payer");
    const lydia = await contact("Lydia Dempsey");
    await recordDuesPayment(
      db,
      householdPayer,
      { level: "family", paymentDate: "2026-09-04" },
      null,
    );
    await attachMember(db, householdPayer, lydia, null);
    await recordDuesPayment(db, lydia, { level: "student", paymentDate: "2026-09-04" }, null);

    const body = await (await read(lydia)).json();
    expect(body.membership.asPayer.level).toBe("student");
    expect(body.membership.asMember.payerDisplayName).toBe("Parent Payer");
  });

  it("a contact on no account has an empty membership block", async () => {
    const id = await contact("No Account");
    const body = await (await read(id)).json();
    expect(body.membership.status).toBe("never");
    expect(body.membership.asPayer).toBeNull();
    expect(body.membership.asMember).toBeNull();
  });

  it("carries names and ids only — no PII to redact (contract §4)", async () => {
    const { payer } = await household();
    const base = await makeBaseActor("base@example.com");
    const body = await (
      await GET_CONTACT(jsonReqAs(base.token, "GET", `/api/contacts/${payer}`), ctx({ id: payer }))
    ).json();

    // A base volunteer is denied contact PII — emails are emptied, as always…
    expect(body.emails).toEqual([]);
    // …but the membership block is names and ids, which they can already read, so it survives intact.
    expect(body.membership.asPayer.level).toBe("supporter");
    expect(JSON.stringify(body.membership)).not.toMatch(/@/); // no address anywhere in the block
  });
});
