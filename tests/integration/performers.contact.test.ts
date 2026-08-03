import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { contactRow } from "./helpers/factories";
import { contactEmails, contacts, performers } from "@/server/db/schema";
import { createPerformer } from "@/server/domain/performers/performerService";

// FR-015: every performer has a contact so the door can check them in.
describe("performer → contact", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("auto-creates a contact when none is linked", async () => {
    const p = await createPerformer(db, { firstName: "Fiona", lastName: "Fiddle" });
    expect(p.contactId).toBeTruthy();
    const contact = await db.query.contacts.findFirst({ where: eq(contacts.id, p.contactId!) });
    expect(contact?.displayName).toBe("Fiona Fiddle");
    expect(contact?.source).toBe("performer");
  });

  it("flags the auto-created contact for review when no email or phone is given", async () => {
    const p = await createPerformer(db, { firstName: "No", lastName: "Info" });
    const contact = await db.query.contacts.findFirst({ where: eq(contacts.id, p.contactId!) });
    expect(contact?.needsReview).toBe(true);
  });

  it("seeds the auto-created contact's phone and does not flag it for review", async () => {
    const p = await createPerformer(db, {
      firstName: "Phone",
      lastName: "Fiddle",
      phone: "585-555-0102",
    });
    const contact = await db.query.contacts.findFirst({ where: eq(contacts.id, p.contactId!) });
    expect(contact?.phone).toBe("+15855550102"); // feature 032: stored canonical
    expect(contact?.needsReview).toBe(false);
  });

  it("seeds the auto-created contact's email", async () => {
    const p = await createPerformer(db, {
      firstName: "Email",
      lastName: "Fiddle",
      email: "email-fiddle@example.com",
    });
    const contact = await db.query.contacts.findFirst({ where: eq(contacts.id, p.contactId!) });
    expect(contact?.needsReview).toBe(false);
    const emails = await db.query.contactEmails.findFirst({
      where: eq(contactEmails.contactId, p.contactId!),
    });
    expect(emails?.email).toBe("email-fiddle@example.com");
    expect(emails?.purposes).toContain("personal"); // default purpose
  });

  it("labels the seeded email 'booking' when emailPurpose is given (feature 020 add-performer)", async () => {
    const p = await createPerformer(db, {
      firstName: "Micah",
      lastName: "Wiesner",
      email: "micah@example.com",
      emailPurpose: "booking",
    });
    const email = await db.query.contactEmails.findFirst({
      where: eq(contactEmails.contactId, p.contactId!),
    });
    expect(email?.purposes).toContain("booking");
    expect(email?.purposes).not.toContain("personal");
  });

  it("reuses an existing contact when one is provided", async () => {
    const [existing] = await db.insert(contacts).values(contactRow("Existing")).returning();
    const p = await createPerformer(db, { contactId: existing!.id });
    expect(p.contactId).toBe(existing!.id);
    const all = await db.select().from(performers).where(eq(performers.id, p.id));
    expect(all).toHaveLength(1);
  });
});
