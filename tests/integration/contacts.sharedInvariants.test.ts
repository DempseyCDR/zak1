import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { createTestIdp, type TestIdp } from "./helpers/oidc";
import { contactEmails, contacts } from "@/server/db/schema";
import { contactRow, makeVolunteerContact } from "./helpers/factories";
import { verifyGoogleIdToken } from "@/server/auth/claims";
import { resolveSignIn } from "@/server/auth/signIn";
import { linkMessageRecipient } from "@/server/domain/contacts/referenceService";

/**
 * Feature 067 (M-R24/M-R25 — FR-006 to FR-008): the invariants a shared email must NOT disturb.
 *
 * A reference is a pointer on `contacts`, not a `contact_emails` row, so active-email uniqueness, the
 * feature-015 sign-in match, and `is_login` ownership hold BY CONSTRUCTION. These are regression
 * guards: they assert the pointer changed nothing, which is the whole safety argument for the design.
 */
describe("shared email leaves uniqueness, sign-in and login untouched (feature 067)", () => {
  let idp: TestIdp;
  beforeAll(async () => {
    await ensureSchema();
    idp = await createTestIdp();
  });
  beforeEach(resetDb);
  afterAll(closeDb);

  async function signIn(sub: string, email: string) {
    const token = await idp.signIdToken({ sub, email, emailVerified: true });
    const verified = await verifyGoogleIdToken(token, {
      jwks: idp.keys,
      issuer: idp.issuer,
      audience: idp.audience,
    });
    if (!verified.ok) throw new Error(`token did not verify: ${verified.reason}`);
    return resolveSignIn(db, verified.claims);
  }

  /** David is a volunteer owning the household address; Bridget references it. */
  async function linkedHousehold() {
    const owner = await makeVolunteerContact({
      firstName: "David",
      lastName: "Jones",
      email: "shared@jones.com",
    });
    const ownerEmail = await db.query.contactEmails.findFirst({
      where: eq(contactEmails.contactId, owner.contactId),
    });
    const [bridget] = await db.insert(contacts).values(contactRow("Bridget Jones")).returning();
    await linkMessageRecipient(db, bridget!.id, { emailId: ownerEmail!.id }, null);
    return { ownerId: owner.contactId, emailId: ownerEmail!.id, referrerId: bridget!.id };
  }

  it("sign-in with a shared address resolves to the OWNER, never ambiguous (FR-007)", async () => {
    const { ownerId } = await linkedHousehold();
    const result = await signIn("google-sub-david", "shared@jones.com");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.contactId).toBe(ownerId);
  });

  it("a referrer is never a sign-in match (FR-007, FR-008)", async () => {
    const { referrerId } = await linkedHousehold();
    // Make the referrer a volunteer too: eligibility is not the point — she has no email ROW, so the
    // email→contact match cannot reach her by construction (M-R25).
    await db.update(contacts).set({ isVolunteer: true }).where(eq(contacts.id, referrerId));
    const rows = await db
      .select()
      .from(contactEmails)
      .where(eq(contactEmails.contactId, referrerId));
    expect(rows).toEqual([]);
    const result = await signIn("google-sub-david", "shared@jones.com");
    // Exactly one match, and it is not her.
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.contactId).not.toBe(referrerId);
  });

  it("a referrer cannot hold is_login — there is no row to carry it (FR-008 / M-R25)", async () => {
    const { referrerId } = await linkedHousehold();
    const logins = await db
      .select()
      .from(contactEmails)
      .where(eq(contactEmails.contactId, referrerId));
    expect(logins.filter((r) => r.isLogin)).toEqual([]);
  });

  it("active-email uniqueness still rejects a second active row for the address (FR-006)", async () => {
    const { emailId, referrerId } = await linkedHousehold();
    expect(emailId).toBeTruthy();
    await expect(
      db.insert(contactEmails).values({ contactId: referrerId, email: "shared@jones.com" }),
    ).rejects.toThrow();
  });
});
