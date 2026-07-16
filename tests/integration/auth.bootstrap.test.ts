import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb } from "./helpers/db";
import { db } from "@/server/db/client";
import { contactEmails, contacts, roleGrants } from "@/server/db/schema";
import { makeContactWithEmail } from "./helpers/factories";
import { bootstrapOfficer } from "@/server/db/bootstrapOfficer";

/**
 * FR-017 / SC-008: the operator bootstrap.
 *
 * Without this nobody can sign in at all — no contact is a volunteer today (0 of ~1335), no UI sets
 * `is_volunteer`, and sign-in requires a volunteer contact with an active email. This is the cold-start
 * path, and it must never resemble `db:seed` (which TRUNCATEs the dev database).
 */
describe("operator bootstrap (FR-017)", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  async function readContact(id: string) {
    const [c] = await db.select().from(contacts).where(eq(contacts.id, id));
    return c;
  }
  async function readEmails(contactId: string) {
    return db.select().from(contactEmails).where(eq(contactEmails.contactId, contactId));
  }

  it("designates a matching contact as a volunteer and marks the email is_login", async () => {
    const { contactId } = await makeContactWithEmail({
      firstName: "Alice",
      email: "alice@cdrochester.org",
    });

    await bootstrapOfficer({ email: "alice@cdrochester.org" });

    expect((await readContact(contactId))?.isVolunteer).toBe(true);
    const emails = await readEmails(contactId);
    expect(emails.filter((e) => e.isLogin)).toHaveLength(1);
    expect(emails.find((e) => e.isLogin)?.email).toBe("alice@cdrochester.org");
  });

  it("is idempotent — re-running changes nothing and does not throw", async () => {
    const { contactId } = await makeContactWithEmail({
      firstName: "Alice",
      email: "alice@cdrochester.org",
    });

    await bootstrapOfficer({ email: "alice@cdrochester.org" });
    await bootstrapOfficer({ email: "alice@cdrochester.org" });

    expect((await readContact(contactId))?.isVolunteer).toBe(true);
    expect((await readEmails(contactId)).filter((e) => e.isLogin)).toHaveLength(1);
  });

  it("grants an optional role as a CLUB-WIDE role_grants row (feature 016)", async () => {
    const { contactId } = await makeContactWithEmail({
      firstName: "Alice",
      email: "alice@cdrochester.org",
    });

    await bootstrapOfficer({ email: "alice@cdrochester.org", role: "super_user" });

    // Roles left contacts.volunteer_roles in migration 0021 — an array cannot carry scope.
    const grants = await db.select().from(roleGrants).where(eq(roleGrants.contactId, contactId));
    expect(grants).toHaveLength(1);
    expect(grants[0]?.role).toBe("super_user");
    // Both NULL IS club-wide scope, not missing data (data-model.md §3).
    expect(grants[0]?.seriesId).toBeNull();
    expect(grants[0]?.groupId).toBeNull();
  });

  it("is idempotent about the grant — a re-run does not duplicate it", async () => {
    const { contactId } = await makeContactWithEmail({
      firstName: "Bob",
      email: "bob@cdrochester.org",
    });

    await bootstrapOfficer({ email: "bob@cdrochester.org", role: "super_user" });
    const second = await bootstrapOfficer({ email: "bob@cdrochester.org", role: "super_user" });

    expect(second.changed).toBe(false);
    const grants = await db.select().from(roleGrants).where(eq(roleGrants.contactId, contactId));
    expect(grants).toHaveLength(1);
  });

  it("refuses when the email matches no contact", async () => {
    await expect(bootstrapOfficer({ email: "nobody@cdrochester.org" })).rejects.toThrow(
      /no contact/i,
    );
  });

  it("refuses an ambiguous email matching multiple contacts", async () => {
    // NOTE: `contact_emails_unique_active` (feature 001) makes an email globally unique among
    // active/transition rows, so two ACTIVE duplicates cannot exist. Ambiguity is reachable only
    // because bootstrap matches any status (so it can reactivate a stale address): here the same
    // address is active on one contact and inactive on another.
    await makeContactWithEmail({ firstName: "Alice", email: "shared@cdrochester.org" });
    await makeContactWithEmail({
      firstName: "Bob",
      email: "shared@cdrochester.org",
      emailStatus: "inactive",
    });

    await expect(bootstrapOfficer({ email: "shared@cdrochester.org" })).rejects.toThrow(
      /ambiguous|multiple/i,
    );
  });

  it("attaches a missing Workspace address when given --contact-id", async () => {
    // The real cold-start gap: officers' cdrochester.org addresses are usually NOT on their contact
    // record yet (0 login emails exist today), so bootstrap must be able to add one.
    const { contactId } = await makeContactWithEmail({
      firstName: "Alice",
      email: "alice.personal@example.com",
    });

    await bootstrapOfficer({ contactId, email: "alice@cdrochester.org" });

    const emails = await readEmails(contactId);
    expect(emails).toHaveLength(2);
    const login = emails.find((e) => e.isLogin);
    expect(login?.email).toBe("alice@cdrochester.org");
    expect(login?.status).toBe("active");
    expect((await readContact(contactId))?.isVolunteer).toBe(true);
  });

  it("refuses --contact-id for a contact that does not exist", async () => {
    await expect(
      bootstrapOfficer({
        contactId: "00000000-0000-0000-0000-000000000000",
        email: "alice@cdrochester.org",
      }),
    ).rejects.toThrow(/no contact/i);
  });
});
