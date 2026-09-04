import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { contacts, statusChangeAudit } from "@/server/db/schema";
import { contactRow, makeMembershipAccount } from "./helpers/factories";
import { refreshAllStatuses } from "@/server/domain/membership/membershipService";

beforeAll(ensureSchema);
beforeEach(resetDb);
afterAll(closeDb);

/**
 * Feature 068 (FR-015a): the one-off correction.
 *
 * Status is derived where it is read (FR-015), so the stored columns are a cache. They must still not be
 * WRONG — 118 memberships went stale at the 1 September 2026 rollover — so this brings them into line with
 * today without anyone editing contacts one at a time.
 */
describe("status backfill (feature 068)", () => {
  const contact = async (name: string) =>
    (await db.insert(contacts).values(contactRow(name)).returning())[0]!.id;

  const lastYear = () => {
    const d = new Date();
    d.setUTCFullYear(d.getUTCFullYear() - 1);
    return d.toISOString().slice(0, 10);
  };

  it("corrects a status that went stale when the year rolled (FR-015a)", async () => {
    const id = await contact("Rolled Over");
    await makeMembershipAccount({ payerContactId: id, expiryDate: lastYear() });
    // The cache still says what it said before the boundary passed.
    await db.update(contacts).set({ membershipStatus: "current" }).where(eq(contacts.id, id));

    const result = await refreshAllStatuses(db);
    expect(result.changed).toBeGreaterThanOrEqual(1);
    const after = await db.query.contacts.findFirst({ where: eq(contacts.id, id) });
    expect(after!.membershipStatus).toBe("lapsed");
  });

  it("sets list_member from ATTACHMENT, not from status history (FR-011)", async () => {
    const member = await contact("Attached Member");
    await makeMembershipAccount({ payerContactId: member, expiryDate: lastYear() });
    const nonMember = await contact("Never Attached");
    // Wrongly cached as a list member by the old "has any history" rule.
    await db
      .update(contacts)
      .set({ listMember: true, membershipStatus: "lapsed" })
      .where(eq(contacts.id, nonMember));

    await refreshAllStatuses(db);
    expect(
      (await db.query.contacts.findFirst({ where: eq(contacts.id, member) }))!.listMember,
    ).toBe(true);
    // On no account → not a member, whatever the cache said.
    expect(
      (await db.query.contacts.findFirst({ where: eq(contacts.id, nonMember) }))!.listMember,
    ).toBe(false);
  });

  it("records an audit row ONLY for statuses that actually changed (FR-015a)", async () => {
    const stale = await contact("Was Stale");
    await makeMembershipAccount({ payerContactId: stale, expiryDate: lastYear() });
    await db.update(contacts).set({ membershipStatus: "current" }).where(eq(contacts.id, stale));

    const alreadyRight = await contact("Already Right");
    await makeMembershipAccount({ payerContactId: alreadyRight, expiryDate: "2099-08-31" });
    await db
      .update(contacts)
      .set({ membershipStatus: "current" })
      .where(eq(contacts.id, alreadyRight));

    await refreshAllStatuses(db);
    const audits = await db.select().from(statusChangeAudit);
    expect(audits.map((a) => a.contactId)).toContain(stale);
    expect(audits.map((a) => a.contactId)).not.toContain(alreadyRight);
  });

  it("is safe to run twice — the second pass changes nothing", async () => {
    const id = await contact("Idempotent");
    await makeMembershipAccount({ payerContactId: id, expiryDate: lastYear() });
    await db.update(contacts).set({ membershipStatus: "current" }).where(eq(contacts.id, id));

    await refreshAllStatuses(db);
    const second = await refreshAllStatuses(db);
    expect(second.changed).toBe(0);
  });
});
