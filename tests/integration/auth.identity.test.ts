import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb } from "./helpers/db";
import { createTestIdp, type TestIdp } from "./helpers/oidc";
import { db } from "@/server/db/client";
import { contactEmails, staffIdentities } from "@/server/db/schema";
import { TEST_STAFF_GOOGLE_SUB } from "./helpers/db";
import { makeVolunteerContact } from "./helpers/factories";
import { verifyGoogleIdToken } from "@/server/auth/claims";
import { resolveSignIn } from "@/server/auth/signIn";

/**
 * FR-006 / FR-012 / FR-014: identity provisioning and the durable google_sub binding.
 */
describe("staff identity provisioning (FR-012, FR-014)", () => {
  let idp: TestIdp;
  beforeAll(async () => {
    await ensureSchema();
    idp = await createTestIdp();
  });
  beforeEach(resetDb);
  afterAll(closeDb);

  const verifier = () => ({ jwks: idp.keys, issuer: idp.issuer, audience: idp.audience });

  /** Identities created BY THE TEST — excludes the harness's standing staff member. */
  async function testIdentities() {
    const all = await db.select().from(staffIdentities);
    return all.filter((i) => i.googleSub !== TEST_STAFF_GOOGLE_SUB);
  }

  async function signIn(sub: string, email: string) {
    const token = await idp.signIdToken({ sub, email });
    const claims = await verifyGoogleIdToken(token, verifier());
    if (!claims.ok) throw new Error(`token rejected: ${claims.reason}`);
    return resolveSignIn(db, claims.claims);
  }

  it("creates an identity on first sign-in and sets the login email (no registration step)", async () => {
    const { contactId } = await makeVolunteerContact({ email: "alice@cdrochester.org" });

    const res = await signIn("google-alice", "alice@cdrochester.org");
    expect(res.ok).toBe(true);

    const identities = await testIdentities();
    expect(identities).toHaveLength(1);
    expect(identities[0]).toMatchObject({ contactId, googleSub: "google-alice" });
    expect(identities[0]?.lastSignInAt).toBeInstanceOf(Date);

    const emails = await db
      .select()
      .from(contactEmails)
      .where(eq(contactEmails.contactId, contactId));
    expect(emails.filter((e) => e.isLogin)).toHaveLength(1);
  });

  it("reuses the identity on a second sign-in", async () => {
    await makeVolunteerContact({ email: "alice@cdrochester.org" });

    const first = await signIn("google-alice", "alice@cdrochester.org");
    const second = await signIn("google-alice", "alice@cdrochester.org");

    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) expect(first.identityId).toBe(second.identityId);
    expect(await testIdentities()).toHaveLength(1);
  });

  it("keeps the binding when a known sub presents a changed email", async () => {
    // google_sub is immutable; email is not. The sub binding wins — it must NOT silently re-point
    // to whatever contact the new address happens to match (research R9).
    const { contactId } = await makeVolunteerContact({ email: "alice@cdrochester.org" });
    await signIn("google-alice", "alice@cdrochester.org");

    const res = await signIn("google-alice", "alice.renamed@cdrochester.org");

    expect(res.ok).toBe(true);
    if (res.ok) expect(res.contactId).toBe(contactId);
    expect(await testIdentities()).toHaveLength(1);
  });

  it("REFUSES a different Google account for a contact that already has an identity", async () => {
    // T019 / the dual-account collision. A long-term volunteer plausibly holds BOTH a personal and a
    // cdrochester.org Google account. This must be a clean `identity_exists` refusal — never a raw
    // contact_id UNIQUE violation. Backlog B38 makes re-binding self-service.
    const { contactId } = await makeVolunteerContact({ email: "alice@cdrochester.org" });

    // Second active address on the same contact (allowed: only *login* emails are one-per-contact).
    await db.insert(contactEmails).values({
      contactId,
      email: "alice.personal@example.com",
      status: "active",
    });

    await signIn("google-personal", "alice.personal@example.com");
    const res = await signIn("google-workspace", "alice@cdrochester.org");

    expect(res).toMatchObject({ ok: false, reason: "identity_exists" });
    expect(await testIdentities()).toHaveLength(1);
  });

  it("lets two different volunteers each hold their own identity", async () => {
    await makeVolunteerContact({ firstName: "Alice", email: "alice@cdrochester.org" });
    await makeVolunteerContact({ firstName: "Bob", email: "bob@cdrochester.org" });

    expect((await signIn("google-alice", "alice@cdrochester.org")).ok).toBe(true);
    expect((await signIn("google-bob", "bob@cdrochester.org")).ok).toBe(true);
    expect(await testIdentities()).toHaveLength(2);
  });
});
