import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { contacts } from "@/server/db/schema";
import { contactRow } from "./helpers/factories";
import { jsonReq, ctx } from "./helpers/http";
import { DELETE as DELETE_CONTACT } from "@/app/api/contacts/[id]/route";
import { contactDeleteBlockers } from "@/server/domain/contacts/contactService";
import { recordDuesPayment } from "@/server/domain/membership/accountService";

beforeAll(ensureSchema);
beforeEach(resetDb);
afterAll(closeDb);

/**
 * Feature 068 (FR-009): an account must never be left without its payer.
 *
 * Historically a payer's contact link was CLEARED on delete rather than the delete being refused, which is
 * how the club ended up with accounts owned by names that were not contacts. The end state is now
 * forbidden and the mechanism that produced it is closed.
 */
describe("a payer's contact cannot be deleted from under their account (feature 068)", () => {
  async function payerWithAccount(name = "Account Owner") {
    const [c] = await db.insert(contacts).values(contactRow(name)).returning();
    await recordDuesPayment(db, c!.id, { level: "individual", paymentDate: "2026-09-04" }, null);
    return c!.id;
  }

  it("lists the account as a delete blocker (FR-009)", async () => {
    const id = await payerWithAccount();
    expect(await contactDeleteBlockers(db, id)).toContain("membership_account");
  });

  it("refuses the safe delete, naming the account in human wording (FR-009a)", async () => {
    const id = await payerWithAccount();
    const res = await DELETE_CONTACT(jsonReq("DELETE", `/api/contacts/${id}`), ctx({ id }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("CONTACT_HAS_REFERENCES");
    expect(body.error.message).toMatch(/membership account/i);
    // Not a table name.
    expect(body.error.message).not.toMatch(/membership_accounts/);
  });

  it("the super-user force path still deletes (FR-009)", async () => {
    const id = await payerWithAccount("Forced Owner");
    const res = await DELETE_CONTACT(jsonReq("DELETE", `/api/contacts/${id}?force=1`), ctx({ id }));
    expect(res.status).toBe(200);
  });
});
