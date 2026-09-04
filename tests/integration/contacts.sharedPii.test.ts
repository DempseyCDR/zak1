import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { contacts } from "@/server/db/schema";
import { contactRow, makeBaseActor, makeContactWithEmail } from "./helpers/factories";
import { jsonReq, jsonReqAs, ctx } from "./helpers/http";
import { GET as GET_CONTACT } from "@/app/api/contacts/[id]/route";
import { linkMessageRecipient } from "@/server/domain/contacts/referenceService";

beforeAll(ensureSchema);
beforeEach(resetDb);
afterAll(closeDb);

/**
 * Feature 067 (FR-016): the RESOLVED address is contact PII, exactly as an owned address is.
 *
 * `projectContact` is a DENYLIST (`{ ...contact, phone: null, emails: [] }`), so a newly added field
 * is exposed by default — it does not inherit protection. Without this, a volunteer denied
 * `contact.pii.read` would be refused David's address on David's record and handed it on Bridget's.
 */
describe("shared email respects contact PII gating (feature 067)", () => {
  async function linkedHousehold() {
    const owner = await makeContactWithEmail({
      firstName: "David",
      lastName: "Jones",
      email: "shared@jones.com",
    });
    const [bridget] = await db.insert(contacts).values(contactRow("Bridget Jones")).returning();
    await linkMessageRecipient(db, bridget!.id, { emailId: owner.emailId }, null);
    return { ownerId: owner.contactId, referrerId: bridget!.id };
  }

  const read = (token: string, id: string) =>
    GET_CONTACT(jsonReqAs(token, "GET", `/api/contacts/${id}`), ctx({ id }));

  it("withholds the resolved address from an actor without contact.pii.read (FR-016)", async () => {
    const { referrerId } = await linkedHousehold();
    const base = await makeBaseActor("base@example.com");

    const body = await (await read(base.token, referrerId)).json();
    expect(body.messageRecipient).toBeTruthy();
    // The address is withheld…
    expect(body.messageRecipient.address).toBeNull();
    // …but the owner's NAME survives, so the record still reads "reached via David Jones".
    expect(body.messageRecipient.ownerDisplayName).toBe("David Jones");
  });

  it("discloses the resolved address to a PII holder (FR-016)", async () => {
    const { referrerId } = await linkedHousehold();
    // The standing test session is a club-wide super_user → holds contact.pii.read.
    const body = await (
      await GET_CONTACT(jsonReq("GET", `/api/contacts/${referrerId}`), ctx({ id: referrerId }))
    ).json();
    expect(body.messageRecipient.address).toBe("shared@jones.com");
  });

  it("leaves sharedWith unredacted — ids and display names only (FR-016)", async () => {
    const { ownerId, referrerId } = await linkedHousehold();
    const base = await makeBaseActor("base2@example.com");

    const body = await (await read(base.token, ownerId)).json();
    expect(body.sharedWith).toEqual([
      expect.objectContaining({ contactId: referrerId, displayName: "Bridget Jones" }),
    ]);
    // The owner's own address is still withheld from a base actor, as before this feature.
    expect(body.emails).toEqual([]);
  });
});
