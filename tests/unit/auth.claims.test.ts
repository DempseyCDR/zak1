import { beforeAll, describe, expect, it } from "vitest";
import { createTestIdp, type TestIdp } from "../integration/helpers/oidc";
import { verifyGoogleIdToken } from "@/server/auth/claims";

/**
 * FR-009: claim validation at the Google boundary.
 *
 * Pure — no database. Tokens are signed by a LOCAL keypair and verified against a LOCAL JWKS
 * (constitution v1.2.0): Google's production endpoints are never contacted.
 */
describe("verifyGoogleIdToken (FR-009)", () => {
  let idp: TestIdp;
  beforeAll(async () => {
    idp = await createTestIdp();
  });

  const verifier = () => ({ jwks: idp.keys, issuer: idp.issuer, audience: idp.audience });

  it("accepts a well-formed, verified-email token", async () => {
    const token = await idp.signIdToken({ sub: "google-123", email: "alice@cdrochester.org" });
    const res = await verifyGoogleIdToken(token, verifier());
    expect(res).toEqual({
      ok: true,
      claims: { sub: "google-123", email: "alice@cdrochester.org", email_verified: true },
    });
  });

  it("REJECTS email_verified: false — the linchpin check", async () => {
    // Without this, a token could assert an arbitrary unverified address and walk straight
    // through the email→contact match that grants staff access.
    const token = await idp.signIdToken({
      sub: "google-123",
      email: "victim@cdrochester.org",
      emailVerified: false,
    });
    expect(await verifyGoogleIdToken(token, verifier())).toEqual({
      ok: false,
      reason: "email_unverified",
    });
  });

  it("rejects a token signed by the wrong key", async () => {
    const token = await idp.signWithWrongKey({ sub: "google-123", email: "a@cdrochester.org" });
    expect(await verifyGoogleIdToken(token, verifier())).toEqual({
      ok: false,
      reason: "token_invalid",
    });
  });

  it("rejects an expired token", async () => {
    const token = await idp.signIdToken({
      sub: "google-123",
      email: "a@cdrochester.org",
      expiresInSeconds: -60,
    });
    expect(await verifyGoogleIdToken(token, verifier())).toEqual({
      ok: false,
      reason: "token_invalid",
    });
  });

  it("rejects a token minted for a different audience", async () => {
    const token = await idp.signIdToken({
      sub: "google-123",
      email: "a@cdrochester.org",
      audience: "some-other-client-id",
    });
    expect(await verifyGoogleIdToken(token, verifier())).toEqual({
      ok: false,
      reason: "token_invalid",
    });
  });

  it("rejects a token from a different issuer", async () => {
    const token = await idp.signIdToken({
      sub: "google-123",
      email: "a@cdrochester.org",
      issuer: "https://evil.example.com",
    });
    expect(await verifyGoogleIdToken(token, verifier())).toEqual({
      ok: false,
      reason: "token_invalid",
    });
  });

  it("rejects garbage", async () => {
    expect(await verifyGoogleIdToken("not-a-jwt", verifier())).toEqual({
      ok: false,
      reason: "token_invalid",
    });
  });
});
