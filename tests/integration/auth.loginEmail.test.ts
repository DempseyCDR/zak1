import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb } from "./helpers/db";
import { db } from "@/server/db/client";
import { contactEmails, contacts } from "@/server/db/schema";
import { makeContactWithEmail } from "./helpers/factories";
import { TEST_STAFF_EMAIL } from "./helpers/db";

/**
 * FR-015: a contact may hold at most ONE login email.
 *
 * `contact_emails.is_login` has existed since feature 001 with no constraint enforcing single
 * designation — a second login email currently succeeds. Migration 0020 adds the partial unique
 * index `contact_emails_one_login_per_contact`, which this pins.
 */
describe("one login email per contact (FR-015)", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  async function makeVolunteerWithLoginEmail(): Promise<string> {
    const { contactId } = await makeContactWithEmail({
      firstName: "Alice",
      lastName: "Officer",
      email: "alice@cdrochester.org",
    });
    await db.update(contacts).set({ isVolunteer: true }).where(eq(contacts.id, contactId));
    await db
      .update(contactEmails)
      .set({ isLogin: true })
      .where(eq(contactEmails.contactId, contactId));
    return contactId;
  }

  it("allows one login email", async () => {
    const contactId = await makeVolunteerWithLoginEmail();
    const rows = await db
      .select()
      .from(contactEmails)
      .where(eq(contactEmails.contactId, contactId));
    expect(rows.filter((r) => r.isLogin)).toHaveLength(1);
  });

  it("rejects a SECOND login email for the same contact", async () => {
    const contactId = await makeVolunteerWithLoginEmail();

    // The real scenario this guards: a long-term volunteer holding both a personal and a
    // cdrochester.org address must not end up with two login emails.
    await expect(
      db.insert(contactEmails).values({
        contactId,
        email: "alice.personal@example.com",
        isLogin: true,
      }),
    ).rejects.toThrow();
  });

  it("still allows many NON-login emails alongside the one login email", async () => {
    const contactId = await makeVolunteerWithLoginEmail();

    await db.insert(contactEmails).values({
      contactId,
      email: "alice.personal@example.com",
      isLogin: false,
    });
    await db.insert(contactEmails).values({
      contactId,
      email: "alice.booking@example.com",
      isLogin: false,
    });

    const rows = await db
      .select()
      .from(contactEmails)
      .where(eq(contactEmails.contactId, contactId));
    expect(rows).toHaveLength(3);
    expect(rows.filter((r) => r.isLogin)).toHaveLength(1);
  });

  it("allows different contacts to each have their own login email", async () => {
    const a = await makeVolunteerWithLoginEmail();
    const { contactId: b } = await makeContactWithEmail({
      firstName: "Bob",
      lastName: "Officer",
      email: "bob@cdrochester.org",
    });
    await db.update(contacts).set({ isVolunteer: true }).where(eq(contacts.id, b));
    await db.update(contactEmails).set({ isLogin: true }).where(eq(contactEmails.contactId, b));

    const rows = (await db.select().from(contactEmails)).filter(
      (r) => r.email !== TEST_STAFF_EMAIL,
    );
    expect(rows.filter((r) => r.isLogin)).toHaveLength(2);
    expect(a).not.toEqual(b);
  });
});
