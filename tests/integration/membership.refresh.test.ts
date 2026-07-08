import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { contacts, memberships, payers, statusChangeAudit } from "@/server/db/schema";
import { contactRow } from "./helpers/factories";
import { refreshAllStatuses } from "@/server/domain/membership/membershipService";

// FR-009, SC-002: daily refresh transitions expired memberships and is idempotent.
describe("refreshAllStatuses (daily job)", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  async function seedExpiredMembershipContact(expiry: string) {
    // Insert membership directly (bypassing recompute) so the contact starts 'never'.
    const [contact] = await db
      .insert(contacts)
      .values(contactRow("Lapsed Person"))
      .returning();
    const [payer] = await db.insert(payers).values({ name: "Payer", contactId: contact!.id }).returning();
    await db
      .insert(memberships)
      .values({ contactId: contact!.id, payerId: payer!.id, expiryDate: expiry });
    return contact!.id;
  }

  it("transitions a stale 'never' contact to 'lapsed' and is idempotent", async () => {
    // expired ~6 months ago → lapsed (within 3-year window)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const ymd = sixMonthsAgo.toISOString().slice(0, 10);
    const contactId = await seedExpiredMembershipContact(ymd);

    const first = await refreshAllStatuses(db);
    expect(first.changed).toBe(1);

    const after = await db.query.contacts.findFirst({ where: eq(contacts.id, contactId) });
    expect(after?.membershipStatus).toBe("lapsed");
    expect(after?.listMember).toBe(true);

    // Second run: no status change → no new audit rows (idempotent).
    const second = await refreshAllStatuses(db);
    expect(second.changed).toBe(0);

    const audits = await db
      .select()
      .from(statusChangeAudit)
      .where(eq(statusChangeAudit.contactId, contactId));
    expect(audits).toHaveLength(1);
  });

  it("classifies long-expired memberships as 'long_lapsed'", async () => {
    const contactId = await seedExpiredMembershipContact("2010-01-01");
    await refreshAllStatuses(db);
    const after = await db.query.contacts.findFirst({ where: eq(contacts.id, contactId) });
    expect(after?.membershipStatus).toBe("long_lapsed");
  });
});
