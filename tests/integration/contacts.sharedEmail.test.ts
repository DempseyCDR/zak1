import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { contactEmails, contacts } from "@/server/db/schema";
import { makeContactWithEmail, contactRow } from "./helpers/factories";
import { jsonReq, ctx } from "./helpers/http";
import { PUT as LINK, DELETE as UNLINK } from "@/app/api/contacts/[id]/message-recipient/route";

// File-level DB lifecycle (single closeDb for the shared pool).
beforeAll(ensureSchema);
beforeEach(resetDb);
afterAll(closeDb);

/** David owns the household address; Bridget is a separate contact with none of her own. */
async function household() {
  const owner = await makeContactWithEmail({
    firstName: "David",
    lastName: "Jones",
    email: "shared@jones.com",
  });
  const [bridget] = await db.insert(contacts).values(contactRow("Bridget Jones")).returning();
  return { ownerId: owner.contactId, ownerEmailId: owner.emailId, referrerId: bridget!.id };
}

const link = (contactId: string, body: unknown) =>
  LINK(
    jsonReq("PUT", `/api/contacts/${contactId}/message-recipient`, body),
    ctx({ id: contactId }),
  );

// Feature 067 (M-R23 / US1): link two people to one household email without merging them.
describe("shared email — link & unlink (feature 067)", () => {
  it("links a referrer to the owner's address; both contacts survive, no uniqueness error (C1)", async () => {
    const { ownerId, ownerEmailId, referrerId } = await household();

    const res = await link(referrerId, { emailId: ownerEmailId });
    expect(res.status).toBe(200);

    // Both records persist, distinct and unmerged.
    const owner = await db.query.contacts.findFirst({ where: eq(contacts.id, ownerId) });
    const referrer = await db.query.contacts.findFirst({ where: eq(contacts.id, referrerId) });
    expect(owner!.mergedIntoId).toBeNull();
    expect(referrer!.mergedIntoId).toBeNull();
    // The referrer holds the pointer and NO email row of her own (FR-002).
    expect(referrer!.messageRecipientEmailId).toBe(ownerEmailId);
    const referrerEmails = await db
      .select()
      .from(contactEmails)
      .where(eq(contactEmails.contactId, referrerId));
    expect(referrerEmails).toEqual([]);
    // The owner still owns the address.
    const ownerEmails = await db
      .select()
      .from(contactEmails)
      .where(eq(contactEmails.contactId, ownerId));
    expect(ownerEmails).toHaveLength(1);
    expect(ownerEmails[0]!.email).toBe("shared@jones.com");
  });

  it("linking to the already-referenced email is idempotent (C1)", async () => {
    const { ownerEmailId, referrerId } = await household();
    expect((await link(referrerId, { emailId: ownerEmailId })).status).toBe(200);
    expect((await link(referrerId, { emailId: ownerEmailId })).status).toBe(200);
    const referrer = await db.query.contacts.findFirst({ where: eq(contacts.id, referrerId) });
    expect(referrer!.messageRecipientEmailId).toBe(ownerEmailId);
  });

  it("unlink clears the pointer and does NOT set needs_review (FR-015)", async () => {
    const { ownerEmailId, referrerId } = await household();
    await link(referrerId, { emailId: ownerEmailId });

    const res = await UNLINK(
      jsonReq("DELETE", `/api/contacts/${referrerId}/message-recipient`),
      ctx({ id: referrerId }),
    );
    expect(res.status).toBe(200);
    const referrer = await db.query.contacts.findFirst({ where: eq(contacts.id, referrerId) });
    expect(referrer!.messageRecipientEmailId).toBeNull();
    // A deliberate edit by Mel is not a lifecycle break (FR-012 reserves the flag for that).
    expect(referrer!.needsReview).toBe(false);
  });

  it("unlinking a contact that references nothing is a no-op 200 (FR-015)", async () => {
    const { referrerId } = await household();
    const res = await UNLINK(
      jsonReq("DELETE", `/api/contacts/${referrerId}/message-recipient`),
      ctx({ id: referrerId }),
    );
    expect(res.status).toBe(200);
  });
});

describe("shared email — guards (feature 067)", () => {
  it("refuses a self-reference with REFERENCE_SELF (FR-003)", async () => {
    const { ownerId, ownerEmailId } = await household();
    const res = await link(ownerId, { emailId: ownerEmailId });
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe("REFERENCE_SELF");
  });

  it("refuses an inactive target with REFERENCE_TARGET_NOT_ACTIVE (FR-014)", async () => {
    const { ownerEmailId, referrerId } = await household();
    await db
      .update(contactEmails)
      .set({ status: "inactive" })
      .where(eq(contactEmails.id, ownerEmailId));
    const res = await link(referrerId, { emailId: ownerEmailId });
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe("REFERENCE_TARGET_NOT_ACTIVE");
  });

  it("refuses a contact that keeps an active address of its own (FR-017)", async () => {
    const { ownerEmailId } = await household();
    const lydia = await makeContactWithEmail({
      firstName: "Lydia",
      lastName: "Dempsey",
      email: "lydia@example.com",
    });
    const res = await link(lydia.contactId, { emailId: ownerEmailId });
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("REFERRER_OWNS_EMAIL");
    // Her own address is untouched by the refusal.
    const rows = await db
      .select()
      .from(contactEmails)
      .where(eq(contactEmails.contactId, lydia.contactId));
    expect(rows[0]!.status).toBe("active");
  });

  it("retireEmailId retires the edited row first, so the address-edit path links cleanly (FR-017)", async () => {
    const { ownerEmailId } = await household();
    // Bridget's own address is dead; Mel is replacing it with the household one.
    const bridget = await makeContactWithEmail({
      firstName: "Bridget",
      lastName: "Jones",
      email: "bridget-old@example.com",
    });
    const res = await link(bridget.contactId, {
      emailId: ownerEmailId,
      retireEmailId: bridget.emailId,
    });
    expect(res.status).toBe(200);

    const referrer = await db.query.contacts.findFirst({
      where: eq(contacts.id, bridget.contactId),
    });
    expect(referrer!.messageRecipientEmailId).toBe(ownerEmailId);
    // Retire = set inactive (M-R17), preserving history and telemetry — not a delete.
    const own = await db.query.contactEmails.findFirst({
      where: eq(contactEmails.id, bridget.emailId),
    });
    expect(own).toBeTruthy();
    expect(own!.status).toBe("inactive");
  });
});
