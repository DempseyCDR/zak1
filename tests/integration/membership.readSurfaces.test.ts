import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { contacts } from "@/server/db/schema";
import { makeContactWithEmail, makeMembershipAccount } from "./helpers/factories";
import { jsonReq, ctx } from "./helpers/http";
import { GET as GET_CONTACT } from "@/app/api/contacts/[id]/route";
import { GET as SEARCH } from "@/app/api/contacts/route";

beforeAll(ensureSchema);
beforeEach(resetDb);
afterAll(closeDb);

/**
 * Feature 068 (FR-015): every surface that reports status must derive it.
 *
 * Re-pointing only the record would have left CONTACT SEARCH — the contacts list and the check-in
 * lookup, the most-used surfaces in the app — reading `contacts.membership_status` straight from
 * `SEARCH_COLS` and showing a value that was true last membership year.
 */
describe("status is derived on every read surface (feature 068)", () => {
  const lastYear = () => {
    const d = new Date();
    d.setUTCFullYear(d.getUTCFullYear() - 1);
    return d.toISOString().slice(0, 10);
  };

  /** A contact whose account lapsed, but whose cached column still insists otherwise. */
  async function staleCurrent(name: string, email: string) {
    const { contactId } = await makeContactWithEmail({ firstName: name, email });
    await makeMembershipAccount({ payerContactId: contactId, expiryDate: lastYear() });
    await db
      .update(contacts)
      .set({ membershipStatus: "current", listMember: true })
      .where(eq(contacts.id, contactId));
    return contactId;
  }

  it("the contact RECORD reports the derived status", async () => {
    const id = await staleCurrent("Recordy", "recordy@example.com");
    const body = await (
      await GET_CONTACT(jsonReq("GET", `/api/contacts/${id}`), ctx({ id }))
    ).json();
    expect(body.membership.status).toBe("lapsed");
  });

  it("contact SEARCH reports the derived status, not the cached column", async () => {
    await staleCurrent("Searchy", "searchy@example.com");
    const body = await (await SEARCH(jsonReq("GET", "/api/contacts?q=Searchy"), ctx())).json();
    const hit = body.items.find((i: { displayName: string }) => i.displayName.includes("Searchy"));
    expect(hit).toBeTruthy();
    expect(hit.membershipStatus).toBe("lapsed");
  });

  it("search reports `never` for a contact on no account, whatever the cache says", async () => {
    const { contactId } = await makeContactWithEmail({
      firstName: "Historic",
      email: "historic@example.com",
    });
    await db
      .update(contacts)
      .set({ membershipStatus: "current", listMember: true })
      .where(eq(contacts.id, contactId));

    const body = await (await SEARCH(jsonReq("GET", "/api/contacts?q=Historic"), ctx())).json();
    const hit = body.items.find((i: { displayName: string }) => i.displayName.includes("Historic"));
    expect(hit.membershipStatus).toBe("never");
  });
});
