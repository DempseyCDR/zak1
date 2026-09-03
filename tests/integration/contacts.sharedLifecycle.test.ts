import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { auditEvents, contactEmails, contacts } from "@/server/db/schema";
import { contactRow, makeContactWithEmail } from "./helpers/factories";
import { addEmail, deleteEmail, patchEmail } from "@/server/domain/contacts/emailService";
import { contactDeleteBlockers, deleteContact } from "@/server/domain/contacts/contactService";
import { mergeContacts } from "@/server/domain/dedup/mergeService";
import { linkMessageRecipient } from "@/server/domain/contacts/referenceService";

beforeAll(ensureSchema);
beforeEach(resetDb);
afterAll(closeDb);

/**
 * Feature 067 (US3 / M-R27 — FR-011, FR-012, FR-013): sharing is not permanent.
 *
 * A reference must never outlive its usefulness: gaining an address of one's own ends it silently, and
 * losing the referenced address clears the pointer AND flags the referrer, so a working address gets
 * re-captured rather than the contact quietly becoming unreachable.
 */
describe("shared email lifecycle (feature 067)", () => {
  async function household() {
    const owner = await makeContactWithEmail({
      firstName: "David",
      lastName: "Jones",
      email: "shared@jones.com",
    });
    const [bridget] = await db.insert(contacts).values(contactRow("Bridget Jones")).returning();
    await linkMessageRecipient(db, bridget!.id, { emailId: owner.emailId }, null);
    return { ownerId: owner.contactId, emailId: owner.emailId, referrerId: bridget!.id };
  }

  const reload = (id: string) => db.query.contacts.findFirst({ where: eq(contacts.id, id) });

  it("gaining an owned address clears the reference, silently (FR-011)", async () => {
    const { referrerId } = await household();
    // The shape the route's Zod schema produces (defaults already applied).
    await addEmail(db, referrerId, {
      address: "bridget@example.com",
      purposes: ["personal"],
      consentTopics: ["contact_tracing"],
      status: "active",
      isLogin: false,
    });

    const referrer = await reload(referrerId);
    expect(referrer!.messageRecipientEmailId).toBeNull();
    // Gaining an address is an improvement, not something to review.
    expect(referrer!.needsReview).toBe(false);
  });

  it("deactivating the referenced address clears the pointer and flags the referrer (FR-012)", async () => {
    const { ownerId, emailId, referrerId } = await household();
    await patchEmail(db, ownerId, emailId, { status: "inactive" });

    const referrer = await reload(referrerId);
    expect(referrer!.messageRecipientEmailId).toBeNull();
    expect(referrer!.needsReview).toBe(true);
  });

  it("hard-deleting the referenced address clears the pointer and flags the referrer (FR-012)", async () => {
    const { ownerId, emailId, referrerId } = await household();
    await deleteEmail(db, ownerId, emailId, null);

    const referrer = await reload(referrerId);
    expect(referrer!.messageRecipientEmailId).toBeNull();
    expect(referrer!.needsReview).toBe(true);
    const audit = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.kind, "contact.reference.cleared"));
    expect(audit.length).toBe(1);
  });

  it("clears EVERY referrer, not just one (FR-012, SC-004)", async () => {
    const { ownerId, emailId, referrerId } = await household();
    const [child] = await db.insert(contacts).values(contactRow("Kid Jones")).returning();
    await linkMessageRecipient(db, child!.id, { emailId }, null);

    await patchEmail(db, ownerId, emailId, { status: "inactive" });
    for (const id of [referrerId, child!.id]) {
      const c = await reload(id);
      expect(c!.messageRecipientEmailId).toBeNull();
      expect(c!.needsReview).toBe(true);
    }
  });

  it("deleting the OWNER contact clears and flags its referrers (FR-012)", async () => {
    const { ownerId, referrerId } = await household();
    // The unrestricted path bypasses the safe-delete guard, so the service must do this itself — the
    // FK's ON DELETE SET NULL would null the pointer without flagging anyone.
    await deleteContact(db, ownerId, { unrestricted: true });

    const referrer = await reload(referrerId);
    expect(referrer!.messageRecipientEmailId).toBeNull();
    expect(referrer!.needsReview).toBe(true);
  });

  it("the SAFE delete refuses to strand a household (feature 065 guard + FR-012)", async () => {
    const { ownerId } = await household();
    expect(await contactDeleteBlockers(db, ownerId)).toContain("shared_email");
  });

  it("merging the owner does NOT orphan a referrer — the email keeps its id (FR-013)", async () => {
    const { ownerId, emailId, referrerId } = await household();
    const [survivor] = await db.insert(contacts).values(contactRow("Dave Jones")).returning();

    await mergeContacts(db, survivor!.id, ownerId, "test");

    const referrer = await reload(referrerId);
    // The pointer still resolves; the row simply belongs to the survivor now.
    expect(referrer!.messageRecipientEmailId).toBe(emailId);
    expect(referrer!.needsReview).toBe(false);
    const email = await db.query.contactEmails.findFirst({ where: eq(contactEmails.id, emailId) });
    expect(email!.contactId).toBe(survivor!.id);
  });
});
