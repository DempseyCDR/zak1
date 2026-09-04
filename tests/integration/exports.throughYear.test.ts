import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { makeContactWithEmail, makeMembershipAccount } from "./helpers/factories";
import { buildListRows } from "@/server/domain/exports/exportService";

// FR-007, SC-003
describe("buildListRows — member through-year", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  // Feature 068: a payer has ONE durable account whose expiry moves, so "most recent expiry" is simply
  // the account's expiry — there is no longer a stack of rows to take the max of.
  const addAccount = (contactId: string, expiryDate: string) =>
    makeMembershipAccount({ payerContactId: contactId, expiryDate });

  it("includes membership_through_year equal to the year of the most recent expiry", async () => {
    const { contactId } = await makeContactWithEmail({ email: "grace@example.com" });
    await addAccount(contactId, "2027-06-01");

    const rows = await buildListRows(db, "member");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.membership_through_year).toBe("2027");
  });

  it("differs correctly across contacts with different expiry dates", async () => {
    const a = await makeContactWithEmail({ email: "a@example.com" });
    const b = await makeContactWithEmail({ email: "b@example.com" });
    await addAccount(a.contactId, "2028-01-01");
    await addAccount(b.contactId, "2024-01-01");

    const rows = await buildListRows(db, "member");
    const byEmail = Object.fromEntries(rows.map((r) => [r.email, r.membership_through_year]));
    expect(byEmail["a@example.com"]).toBe("2028");
    expect(byEmail["b@example.com"]).toBe("2024");
  });
});
