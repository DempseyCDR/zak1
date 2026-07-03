import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { makeContactWithEmail } from "./helpers/factories";
import { memberships, payers } from "@/server/db/schema";
import { buildListRows } from "@/server/domain/exports/exportService";

// FR-007, SC-003
describe("buildListRows — member through-year", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  async function addMembership(contactId: string, expiryDate: string) {
    const [payer] = await db.insert(payers).values({ name: "Test Payer" }).returning();
    await db.insert(memberships).values({ contactId, payerId: payer!.id, expiryDate });
  }

  it("includes membership_through_year equal to the year of the most recent expiry", async () => {
    const { contactId } = await makeContactWithEmail({
      email: "grace@example.com",
      listMember: true,
      membershipStatus: "current",
    });
    await addMembership(contactId, "2026-01-01");
    await addMembership(contactId, "2027-06-01"); // most recent expiry wins

    const rows = await buildListRows(db, "member");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.membership_through_year).toBe("2027");
  });

  it("differs correctly across contacts with different expiry dates", async () => {
    const a = await makeContactWithEmail({
      email: "a@example.com",
      listMember: true,
      membershipStatus: "current",
    });
    const b = await makeContactWithEmail({
      email: "b@example.com",
      listMember: true,
      membershipStatus: "lapsed",
    });
    await addMembership(a.contactId, "2028-01-01");
    await addMembership(b.contactId, "2024-01-01");

    const rows = await buildListRows(db, "member");
    const byEmail = Object.fromEntries(rows.map((r) => [r.email, r.membership_through_year]));
    expect(byEmail["a@example.com"]).toBe("2028");
    expect(byEmail["b@example.com"]).toBe("2024");
  });
});
