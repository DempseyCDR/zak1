import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { makeContactWithEmail, makeMembershipAccount } from "./helpers/factories";
import { buildListRows } from "@/server/domain/exports/exportService";

// FR-002, FR-002a, FR-003, FR-004, SC-004
describe("buildListRows — member", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  // Feature 068: membership follows ATTACHMENT to an account (FR-011), so these build real accounts
  // rather than setting the cached list_member / membership_status columns.
  const future = "2099-08-31";
  const lapsedExpiry = () => {
    const d = new Date();
    d.setUTCFullYear(d.getUTCFullYear() - 1);
    return d.toISOString().slice(0, 10);
  };
  const longLapsedExpiry = "2015-08-31";

  it("includes a current member with the membership_status column", async () => {
    const { contactId } = await makeContactWithEmail({
      displayName: "Grace Hopper",
      email: "grace@example.com",
    });
    await makeMembershipAccount({ payerContactId: contactId, expiryDate: future });
    const rows = await buildListRows(db, "member");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.membership_status).toBe("current");
  });

  it("includes lapsed and long_lapsed members, excludes never", async () => {
    const lapsed = await makeContactWithEmail({ email: "lapsed@example.com" });
    await makeMembershipAccount({ payerContactId: lapsed.contactId, expiryDate: lapsedExpiry() });
    const long = await makeContactWithEmail({ email: "long-lapsed@example.com" });
    await makeMembershipAccount({ payerContactId: long.contactId, expiryDate: longLapsedExpiry });
    // On no account at all — never a member, so absent whatever their history says.
    await makeContactWithEmail({ email: "never@example.com" });
    const rows = await buildListRows(db, "member");
    expect(rows.map((r) => r.email).sort()).toEqual([
      "lapsed@example.com",
      "long-lapsed@example.com",
    ]);
  });

  it("excludes an email explicitly carrying Do Not Contact even though they are a member", async () => {
    const { contactId } = await makeContactWithEmail({
      email: "dnc-member@example.com",
      consentTopics: ["do_not_contact"],
    });
    await makeMembershipAccount({ payerContactId: contactId, expiryDate: future });
    const rows = await buildListRows(db, "member");
    expect(rows).toHaveLength(0);
  });

  it("excludes a transition/inactive email even when they are a member", async () => {
    const { contactId } = await makeContactWithEmail({
      email: "transition-member@example.com",
      emailStatus: "transition",
    });
    await makeMembershipAccount({ payerContactId: contactId, expiryDate: future });
    const rows = await buildListRows(db, "member");
    expect(rows).toHaveLength(0);
  });
});
