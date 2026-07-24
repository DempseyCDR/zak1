import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { makeContactWithEmail, makeEvent, makeDoorRecord } from "./helpers/factories";
import { createMembership, createPayer } from "@/server/domain/membership/membershipService";
import { gateSales, memberships, statusChangeAudit, contacts } from "@/server/db/schema";

// Feature 019 (FR-001, FR-015): createMembership must be transaction-capable so the door flow can commit
// a membership atomically with the gate sale, and both channels share one path.
describe("createMembership — transactional (DbOrTx)", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("rolls back membership, status change, and audit when the surrounding transaction throws", async () => {
    const { contactId } = await makeContactWithEmail({
      displayName: "Rollback Rita",
      email: "rita@ex.com",
    });
    const payer = await createPayer(db, { name: "Rollback Rita", contactId });

    await expect(
      db.transaction(async (tx) => {
        await createMembership(
          tx,
          { contactId, payerId: payer.id, expiryDate: "2027-08-31" },
          "test",
        );
        throw new Error("boom — force rollback");
      }),
    ).rejects.toThrow("boom");

    // Nothing persisted: no membership, no status flip, no audit row.
    const mem = await db.query.memberships.findFirst({
      where: eq(memberships.contactId, contactId),
    });
    expect(mem).toBeUndefined();
    const contact = await db.query.contacts.findFirst({ where: eq(contacts.id, contactId) });
    expect(contact?.membershipStatus).toBe("never");
    const audit = await db.query.statusChangeAudit.findFirst({
      where: eq(statusChangeAudit.contactId, contactId),
    });
    expect(audit).toBeUndefined();
  });

  it("commits membership + status + audit atomically when handed a plain Db (opens its own tx)", async () => {
    const { contactId } = await makeContactWithEmail({
      displayName: "Commit Cora",
      email: "cora@ex.com",
    });
    const payer = await createPayer(db, { name: "Commit Cora", contactId });

    await createMembership(db, { contactId, payerId: payer.id, expiryDate: "2099-08-31" }, "test");

    const contact = await db.query.contacts.findFirst({ where: eq(contacts.id, contactId) });
    expect(contact?.membershipStatus).toBe("current");
  });

  it("rejects a duplicate source_gate_sale_id via the partial unique index (idempotency, R5)", async () => {
    const { contactId } = await makeContactWithEmail({
      displayName: "Dup Dan",
      email: "dan@ex.com",
    });
    const payer = await createPayer(db, { name: "Dup Dan", contactId });
    // A real gate sale to satisfy the FK; the point under test is the partial unique index on the source.
    // Use a 'donation' line, not 'membership' — the latter would now auto-enroll and consume this source.
    const event = await makeEvent();
    await makeDoorRecord(event.id, [
      { category: "donation", paymentMethod: "cash", amount: 25, contactId },
    ]);
    const sale = await db.query.gateSales.findFirst({ where: eq(gateSales.contactId, contactId) });
    if (!sale) throw new Error("expected a seeded gate sale");

    await createMembership(
      db,
      { contactId, payerId: payer.id, expiryDate: "2099-08-31", sourceGateSaleId: sale.id },
      "test",
    );
    await expect(
      createMembership(
        db,
        { contactId, payerId: payer.id, expiryDate: "2099-08-31", sourceGateSaleId: sale.id },
        "test",
      ),
    ).rejects.toThrow();
  });
});
