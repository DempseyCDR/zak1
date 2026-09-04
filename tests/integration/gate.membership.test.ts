import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { makeContactWithEmail, makeEvent } from "./helpers/factories";
import { createDoorRecord, putGateSales } from "@/server/domain/door/doorRecordService";
import { gateSales, membershipAccounts, membershipMembers } from "@/server/db/schema";
import { contactMembership } from "@/server/domain/membership/membershipStatus";

/**
 * Feature 019 US1 (FR-001..FR-004): a NAMED membership gate line creates/renews the membership, atomically
 * with the gate sale. Anonymous lines record money only. Idempotent across the replace-all gate save.
 *
 * Feature 068 re-pointed this at the ACCOUNT model: dues open or renew the payer's durable account rather
 * than inserting a row per person, and the level is recorded on the line. The behaviours asserted here are
 * unchanged — only the shape they are asserted against.
 */
describe("door membership enrollment (putGateSales reconcile)", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  async function setup(displayName: string, email: string) {
    const { contactId } = await makeContactWithEmail({ displayName, email });
    const event = await makeEvent(); // eventDate 2026-06-18 → next 08-31 boundary = 2026-08-31
    const dr = await createDoorRecord(db, event.id, "test");
    return { contactId, doorRecordId: dr.id };
  }

  const duesLine = (contactId: string, level: "individual" | "family" = "individual") => ({
    sales: [
      {
        category: "membership" as const,
        paymentMethod: "cash" as const,
        amount: 25,
        contactId,
        membershipLevel: level,
      },
    ],
  });

  const accountFor = (payerContactId: string) =>
    db.query.membershipAccounts.findFirst({
      where: eq(membershipAccounts.payerContactId, payerContactId),
    });

  it("(a) a named membership line opens an account and the contact reads as current", async () => {
    // The event is dated TODAY on purpose. This assertion used to hard-code a 2026-06-18 dance and expect
    // `current`; it began failing on 2026-09-01 when real time crossed the membership-year boundary and
    // that dance's coverage (expiring 2026-08-31) genuinely lapsed. The fixture was time-dependent, not
    // the code — deriving status does not rescue an assertion about a date in the past.
    const { contactId } = await makeContactWithEmail({
      displayName: "Nina Named",
      email: "nina@ex.com",
    });
    const today = new Date().toISOString().slice(0, 10);
    const event = await makeEvent({ eventDate: today });
    const dr = await createDoorRecord(db, event.id, "test");
    await putGateSales(db, dr.id, duesLine(contactId));

    expect(await accountFor(contactId)).toBeDefined();
    // Feature 068: status is DERIVED, so this is true of today rather than of the last write.
    expect((await contactMembership(db, contactId)).status).toBe("current");
  });

  it("(b) expiry is the next membership-year-end after the event date", async () => {
    const { contactId, doorRecordId } = await setup("Ed Expiry", "ed@ex.com");
    await putGateSales(db, doorRecordId, duesLine(contactId));
    expect((await accountFor(contactId))?.expiryDate).toBe("2026-08-31");
  });

  it("(c) saving identical gate sales twice creates exactly one account (R5 trap)", async () => {
    const { contactId, doorRecordId } = await setup("Ida Idem", "ida@ex.com");
    await putGateSales(db, doorRecordId, duesLine(contactId));
    await putGateSales(db, doorRecordId, duesLine(contactId));
    const accounts = await db
      .select()
      .from(membershipAccounts)
      .where(eq(membershipAccounts.payerContactId, contactId));
    expect(accounts).toHaveLength(1);
  });

  it("(d) an anonymous membership line records money only, no account", async () => {
    // Constructed at the service level: the gate API requires a contact for membership lines, so this is
    // the defensive guard (FR-002) — money is recorded, no membership created.
    const event = await makeEvent();
    const dr = await createDoorRecord(db, event.id, "test");
    await putGateSales(db, dr.id, {
      sales: [{ category: "membership", paymentMethod: "cash", amount: 25 }],
    });
    expect(await db.select().from(gateSales).where(eq(gateSales.doorRecordId, dr.id))).toHaveLength(
      1,
    );
    expect(await db.select().from(membershipAccounts)).toHaveLength(0);
  });

  it("(e) a failure in a membership line rolls back the gate sale too (FR-001 scenario 4)", async () => {
    const { doorRecordId } = await setup("Val Valid", "val@ex.com");
    const bogusContact = "00000000-0000-0000-0000-0000000000ff"; // valid UUID, no such contact
    await expect(
      putGateSales(db, doorRecordId, {
        sales: [
          { category: "merchandise", paymentMethod: "cash", amount: 10 },
          {
            category: "membership",
            paymentMethod: "cash",
            amount: 25,
            contactId: bogusContact,
            membershipLevel: "individual",
          },
        ],
      }),
    ).rejects.toThrow();
    // Neither the (valid) merchandise line nor any account persisted — one atomic unit.
    expect(
      await db.select().from(gateSales).where(eq(gateSales.doorRecordId, doorRecordId)),
    ).toHaveLength(0);
    expect(await db.select().from(membershipAccounts)).toHaveLength(0);
  });

  it("(f) removing a membership line does NOT revoke the membership (R5 asymmetry)", async () => {
    const { contactId, doorRecordId } = await setup("Rem Remove", "rem@ex.com");
    await putGateSales(db, doorRecordId, duesLine(contactId));
    // Re-save with the membership line gone (e.g. FS removed it).
    await putGateSales(db, doorRecordId, { sales: [] });
    expect(await accountFor(contactId)).toBeDefined(); // the membership survives the line's removal
  });

  it("(g) the payer is attached to their own account, with no separate step (FR-007)", async () => {
    const { contactId, doorRecordId } = await setup("Pat Payer", "pat@ex.com");
    await putGateSales(db, doorRecordId, duesLine(contactId));
    const account = await accountFor(contactId);
    const members = await db
      .select()
      .from(membershipMembers)
      .where(eq(membershipMembers.accountId, account!.id));
    expect(members.map((m) => m.contactId)).toEqual([contactId]);
  });

  it("(h) the level chosen on the line is what the account records (feature 068, FR-005)", async () => {
    const { contactId, doorRecordId } = await setup("Fam Ily", "fam@ex.com");
    await putGateSales(db, doorRecordId, duesLine(contactId, "family"));
    expect((await accountFor(contactId))?.level).toBe("family");
  });
});
