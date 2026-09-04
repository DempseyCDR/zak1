import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { attendance, contactEmails, contacts } from "@/server/db/schema";
import { contactRow, makeContactWithEmail, makeEvent } from "./helpers/factories";
import { buildContactTracingRows } from "@/server/domain/exports/contactTracingService";
import { linkMessageRecipient } from "@/server/domain/contacts/referenceService";

beforeAll(ensureSchema);
beforeEach(resetDb);
afterAll(closeDb);

/**
 * Feature 067 (US2 / FR-010, FR-010a): contact tracing is NOT one of the six mailing lists — it is a
 * separate, attendance-driven export. Attendance is a contact-row property, so an attending referrer
 * does pull the household address in; the owner's `contact_tracing` consent still gates it.
 *
 * This is the motivating case: a family gives one address for tracing.
 */
describe("contact-tracing export resolves shared references (feature 067)", () => {
  async function household(consent: "contact_tracing" | "contra" = "contact_tracing") {
    const owner = await makeContactWithEmail({
      firstName: "David",
      lastName: "Jones",
      email: "shared@jones.com",
      consentTopics: [consent],
    });
    const [bridget] = await db.insert(contacts).values(contactRow("Bridget Jones")).returning();
    await linkMessageRecipient(db, bridget!.id, { emailId: owner.emailId }, null);
    return { ownerId: owner.contactId, emailId: owner.emailId, referrerId: bridget!.id };
  }

  it("an attending referrer pulls the owner's address in, under the owner's name (FR-010a)", async () => {
    const evt = await makeEvent({ eventDate: "2026-06-18" });
    const { referrerId } = await household();
    // Only Bridget attended; David did not.
    await db.insert(attendance).values([{ eventId: evt.id, contactId: referrerId }]);

    const { rows } = await buildContactTracingRows(db, evt.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      email: "shared@jones.com",
      first_name: "David",
      last_name: "Jones",
      date: "2026-06-18",
    });
  });

  it("both attending yields ONE row — the household is reached once (FR-010, SC-002)", async () => {
    const evt = await makeEvent({ eventDate: "2026-06-18" });
    const { ownerId, referrerId } = await household();
    await db.insert(attendance).values([
      { eventId: evt.id, contactId: ownerId },
      { eventId: evt.id, contactId: referrerId },
    ]);

    const { rows, count } = await buildContactTracingRows(db, evt.id);
    expect(count).toBe(2); // both really attended…
    expect(rows.filter((r) => r.email === "shared@jones.com")).toHaveLength(1); // …reached once
  });

  it("the owner's consent still gates the address (FR-010a)", async () => {
    const evt = await makeEvent({ eventDate: "2026-06-18" });
    const { referrerId } = await household("contra"); // no contact_tracing consent
    await db.insert(attendance).values([{ eventId: evt.id, contactId: referrerId }]);

    const { rows } = await buildContactTracingRows(db, evt.id);
    expect(rows).toEqual([]);
  });

  it("a referrer whose owner address went inactive contributes no row (FR-010)", async () => {
    const evt = await makeEvent({ eventDate: "2026-06-18" });
    const { emailId, referrerId } = await household();
    await db.update(contactEmails).set({ status: "inactive" }).where(eq(contactEmails.id, emailId));
    await db.insert(attendance).values([{ eventId: evt.id, contactId: referrerId }]);

    const { rows } = await buildContactTracingRows(db, evt.id);
    expect(rows).toEqual([]);
  });
});
