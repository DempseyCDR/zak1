import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { makeContactWithEmail, makeEvent } from "./helpers/factories";
import { createDoorRecord, putGateSales } from "@/server/domain/door/doorRecordService";
import { gateSales, memberships, contacts, payers } from "@/server/db/schema";

// Feature 019 US1 (FR-001..FR-004): a NAMED membership gate line creates/renews the membership, atomically
// with the gate sale. Anonymous lines record money only. Idempotent across the replace-all gate save.
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

  it("(a) a named membership line creates a membership and recomputes status", async () => {
    const { contactId, doorRecordId } = await setup("Nina Named", "nina@ex.com");
    await putGateSales(db, doorRecordId, {
      sales: [{ category: "membership", paymentMethod: "cash", amount: 25, contactId }],
    });
    const mem = await db.query.memberships.findFirst({
      where: eq(memberships.contactId, contactId),
    });
    expect(mem).toBeDefined();
    const contact = await db.query.contacts.findFirst({ where: eq(contacts.id, contactId) });
    expect(contact?.membershipStatus).toBe("current");
  });

  it("(b) expiry is the next membership-year-end after the event date", async () => {
    const { contactId, doorRecordId } = await setup("Ed Expiry", "ed@ex.com");
    await putGateSales(db, doorRecordId, {
      sales: [{ category: "membership", paymentMethod: "cash", amount: 25, contactId }],
    });
    const mem = await db.query.memberships.findFirst({
      where: eq(memberships.contactId, contactId),
    });
    expect(mem?.expiryDate).toBe("2026-08-31");
  });

  it("(c) saving identical gate sales twice creates exactly one membership (R5 trap)", async () => {
    const { contactId, doorRecordId } = await setup("Ida Idem", "ida@ex.com");
    const input = {
      sales: [
        { category: "membership" as const, paymentMethod: "cash" as const, amount: 25, contactId },
      ],
    };
    await putGateSales(db, doorRecordId, input);
    await putGateSales(db, doorRecordId, input);
    const mems = await db.select().from(memberships).where(eq(memberships.contactId, contactId));
    expect(mems).toHaveLength(1);
  });

  it("(d) an anonymous membership line records money only, no membership", async () => {
    // Constructed at the service level: the gate API requires a contact for membership lines, so this is
    // the defensive guard (FR-002) — money is recorded, no membership created.
    const event = await makeEvent();
    const dr = await createDoorRecord(db, event.id, "test");
    await putGateSales(db, dr.id, {
      sales: [{ category: "membership", paymentMethod: "cash", amount: 25 }],
    });
    const sales = await db.select().from(gateSales).where(eq(gateSales.doorRecordId, dr.id));
    expect(sales).toHaveLength(1);
    const mems = await db.select().from(memberships);
    expect(mems).toHaveLength(0);
  });

  it("(e) a failure in a membership line rolls back the gate sale too (FR-001 scenario 4)", async () => {
    const { doorRecordId } = await setup("Val Valid", "val@ex.com");
    const bogusContact = "00000000-0000-0000-0000-0000000000ff"; // valid UUID, no such contact
    await expect(
      putGateSales(db, doorRecordId, {
        sales: [
          { category: "merchandise", paymentMethod: "cash", amount: 10 },
          { category: "membership", paymentMethod: "cash", amount: 25, contactId: bogusContact },
        ],
      }),
    ).rejects.toThrow();
    // Neither the (valid) merchandise line nor any membership persisted — one atomic unit.
    const sales = await db.select().from(gateSales).where(eq(gateSales.doorRecordId, doorRecordId));
    expect(sales).toHaveLength(0);
    const mems = await db.select().from(memberships);
    expect(mems).toHaveLength(0);
  });

  it("(f) removing a membership line does NOT revoke the membership (R5 asymmetry)", async () => {
    const { contactId, doorRecordId } = await setup("Rem Remove", "rem@ex.com");
    await putGateSales(db, doorRecordId, {
      sales: [{ category: "membership", paymentMethod: "cash", amount: 25, contactId }],
    });
    // Re-save with the membership line gone (e.g. FS removed it).
    await putGateSales(db, doorRecordId, { sales: [] });
    const mems = await db.select().from(memberships).where(eq(memberships.contactId, contactId));
    expect(mems).toHaveLength(1); // membership survives; only its provenance FK degrades
  });

  it("(g) a contact with no payer record gets one created (payer_id is NOT NULL)", async () => {
    const { contactId, doorRecordId } = await setup("Pat Payer", "pat@ex.com");
    const before = await db.select().from(payers).where(eq(payers.contactId, contactId));
    expect(before).toHaveLength(0);
    await putGateSales(db, doorRecordId, {
      sales: [{ category: "membership", paymentMethod: "cash", amount: 25, contactId }],
    });
    const after = await db.select().from(payers).where(eq(payers.contactId, contactId));
    expect(after.length).toBeGreaterThanOrEqual(1);
    const mem = await db.query.memberships.findFirst({
      where: and(eq(memberships.contactId, contactId)),
    });
    expect(mem?.payerId).toBe(after[0]!.id);
  });
});
