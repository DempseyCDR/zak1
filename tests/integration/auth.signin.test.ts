import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb } from "./helpers/db";
import { createTestIdp, type TestIdp } from "./helpers/oidc";
import { db } from "@/server/db/client";
import { contactEmails, contacts } from "@/server/db/schema";
import { makeContactWithEmail, makeVolunteerContact } from "./helpers/factories";
import { TEST_STAFF_EMAIL } from "./helpers/db";
import { verifyGoogleIdToken } from "@/server/auth/claims";
import { resolveSignIn } from "@/server/auth/signIn";

/**
 * FR-009 / FR-013 / SC-007: who may sign in.
 *
 * Google's verified email must match an ACTIVE email on exactly one VOLUNTEER contact. Every refusal
 * is generic to the user; the reason is server-side only.
 */
describe("sign-in resolution (FR-009, FR-013)", () => {
  let idp: TestIdp;
  beforeAll(async () => {
    await ensureSchema();
    idp = await createTestIdp();
  });
  beforeEach(resetDb);
  afterAll(closeDb);

  const verifier = () => ({ jwks: idp.keys, issuer: idp.issuer, audience: idp.audience });

  async function signIn(sub: string, email: string, emailVerified = true) {
    const token = await idp.signIdToken({ sub, email, emailVerified });
    const claims = await verifyGoogleIdToken(token, verifier());
    if (!claims.ok) return { ok: false as const, reason: claims.reason };
    return resolveSignIn(db, claims.claims);
  }

  it("admits a volunteer whose active email matches", async () => {
    const { contactId } = await makeVolunteerContact({ email: "alice@cdrochester.org" });
    const res = await signIn("google-alice", "alice@cdrochester.org");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.contactId).toBe(contactId);
  });

  it("matches case-insensitively (contact_emails is citext)", async () => {
    await makeVolunteerContact({ email: "alice@cdrochester.org" });
    const res = await signIn("google-alice", "Alice@CDRochester.ORG");
    expect(res.ok).toBe(true);
  });

  it("refuses when no contact has the email", async () => {
    const res = await signIn("google-nobody", "stranger@example.com");
    expect(res).toMatchObject({ ok: false, reason: "no_match" });
  });

  it("refuses a matching contact who is NOT a volunteer", async () => {
    await makeContactWithEmail({ firstName: "Dancer", email: "dancer@example.com" });
    const res = await signIn("google-dancer", "dancer@example.com");
    expect(res).toMatchObject({ ok: false, reason: "not_volunteer" });
  });

  it("refuses when the volunteer's matching email is INACTIVE", async () => {
    await makeVolunteerContact({ email: "old@cdrochester.org", emailStatus: "inactive" });
    const res = await signIn("google-old", "old@cdrochester.org");
    expect(res).toMatchObject({ ok: false, reason: "no_match" });
  });

  it("refuses an unverified email before any lookup happens", async () => {
    await makeVolunteerContact({ email: "alice@cdrochester.org" });
    const res = await signIn("google-impostor", "alice@cdrochester.org", false);
    expect(res).toMatchObject({ ok: false, reason: "email_unverified" });
  });

  it("does not create an identity for any refused sign-in", async () => {
    await makeContactWithEmail({ firstName: "Dancer", email: "dancer@example.com" });
    await signIn("google-dancer", "dancer@example.com");
    await signIn("google-nobody", "stranger@example.com");
    const logins = (
      await db.select().from(contactEmails).where(eq(contactEmails.isLogin, true))
    ).filter((e) => e.email !== TEST_STAFF_EMAIL);
    expect(logins).toHaveLength(0);
  });

  it("refuses a volunteer whose access is withdrawn (FR-011 at sign-in)", async () => {
    const { contactId } = await makeVolunteerContact({ email: "alice@cdrochester.org" });
    await db.update(contacts).set({ isVolunteer: false }).where(eq(contacts.id, contactId));
    const res = await signIn("google-alice", "alice@cdrochester.org");
    expect(res).toMatchObject({ ok: false, reason: "not_volunteer" });
  });
});
