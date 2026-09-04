import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { auditEvents, membershipAccounts, membershipMembers, contacts } from "@/server/db/schema";
import { contactRow } from "./helpers/factories";
import { recordDuesPayment } from "@/server/domain/membership/accountService";
import { grantedMembershipExpiry } from "@/server/domain/membership/membershipTerm";

beforeAll(ensureSchema);
beforeEach(resetDb);
afterAll(closeDb);

/**
 * Feature 068 (US1): dues buy a household account. One payment — payer, level, date — and the system
 * derives the validity itself. A second payment RENEWS the same account (FR-004): the club's members do
 * not get re-attached every September.
 */
describe("recording a dues payment (feature 068)", () => {
  const contact = async (name: string) =>
    (await db.insert(contacts).values(contactRow(name)).returning())[0]!.id;

  const accountFor = (payerId: string) =>
    db.query.membershipAccounts.findFirst({
      where: eq(membershipAccounts.payerContactId, payerId),
    });

  const membersOf = async (accountId: string) =>
    (
      await db
        .select({ contactId: membershipMembers.contactId })
        .from(membershipMembers)
        .where(eq(membershipMembers.accountId, accountId))
    ).map((r) => r.contactId);

  it("opens an account, derives the expiry, and attaches the payer (FR-001, FR-002, FR-007)", async () => {
    const payer = await contact("New Member");
    await recordDuesPayment(db, payer, { level: "individual", paymentDate: "2026-09-04" }, null);

    const acct = await accountFor(payer);
    expect(acct).toBeTruthy();
    expect(acct!.level).toBe("individual");
    // The FS never calculates this: next year-end on/after payment + the 2-month early-renewal grace.
    expect(acct!.expiryDate).toBe(grantedMembershipExpiry("2026-09-04", "08-31"));
    expect(acct!.lastPaymentDate).toBe("2026-09-04");
    expect(await membersOf(acct!.id)).toEqual([payer]);
  });

  it("a further payment RENEWS the same account and keeps its members (FR-004, SC-002)", async () => {
    const payer = await contact("Cindy Culbert");
    const spouse = await contact("Rich Culbert");
    await recordDuesPayment(db, payer, { level: "family", paymentDate: "2025-09-04" }, null);
    const first = await accountFor(payer);
    await db.insert(membershipMembers).values({ accountId: first!.id, contactId: spouse });

    await recordDuesPayment(db, payer, { level: "family", paymentDate: "2026-09-04" }, null);

    const all = await db.select().from(membershipAccounts);
    expect(all).toHaveLength(1); // renewed, not duplicated
    expect(all[0]!.id).toBe(first!.id);
    expect(all[0]!.expiryDate).toBe(grantedMembershipExpiry("2026-09-04", "08-31"));
    // Nobody had to be re-attached.
    expect((await membersOf(first!.id)).sort()).toEqual([payer, spouse].sort());
  });

  it("a renewal may change the level (FR-024)", async () => {
    const payer = await contact("Upgrader");
    await recordDuesPayment(db, payer, { level: "individual", paymentDate: "2025-09-04" }, null);
    await recordDuesPayment(db, payer, { level: "supporter", paymentDate: "2026-09-04" }, null);

    expect((await accountFor(payer))!.level).toBe("supporter");
  });

  it("a payment that does not extend coverage leaves the expiry alone (FR-004 renewal no-op)", async () => {
    const payer = await contact("Early Payer");
    await recordDuesPayment(db, payer, { level: "individual", paymentDate: "2026-09-04" }, null);
    const after = (await accountFor(payer))!.expiryDate;

    // An earlier payment cannot pull coverage backwards.
    await recordDuesPayment(db, payer, { level: "individual", paymentDate: "2026-01-04" }, null);
    expect((await accountFor(payer))!.expiryDate).toBe(after);
  });

  it("records a durable audit row for the payment (Principle IV)", async () => {
    const payer = await contact("Audited Payer");
    await recordDuesPayment(db, payer, { level: "family", paymentDate: "2026-09-04" }, null);
    const audit = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.kind, "membership.payment_recorded"));
    expect(audit).toHaveLength(1);
  });
});
