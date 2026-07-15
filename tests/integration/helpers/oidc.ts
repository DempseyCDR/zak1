import {
  SignJWT,
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  type JSONWebKeySet,
  type JWTVerifyGetKey,
} from "jose";

/** Inferred rather than imported: jose v6 dropped the `KeyLike` export. */
type SignKey = Awaited<ReturnType<typeof generateKeyPair>>["privateKey"];

/**
 * Local OIDC boundary fixture — the seam constitution v1.2.0 permits.
 *
 * The suite MUST NOT call Google's production endpoints: that is unreliable (rate limits, abuse
 * detection, availability) and no more "real" than testing against a production database. Instead we
 * reproduce the provider's *verified contract* — a signed ID token — with an ephemeral local keypair
 * and a local JWKS, and inject that JWKS into the verifier.
 *
 * Everything BEHIND this seam (email_verified enforcement, email→contact matching, the exactly-one
 * rule, the is_volunteer gate, is_login designation, session lifecycle) is our own logic and is
 * exercised against real Postgres.
 *
 * If a test ever needs network access to Google, the seam has been bypassed — that is a design smell,
 * not a reason to loosen the rule.
 */

const ISSUER = "https://accounts.google.com";
const KID = "test-key-1";

export type TestIdp = {
  issuer: string;
  audience: string;
  /** The raw local key set (for assertions/debugging). */
  jwks: JSONWebKeySet;
  /**
   * The local key resolver to hand the verifier in place of Google's remote JWKS. This — not the
   * raw `jwks` object — is what `jwtVerify` expects.
   */
  keys: JWTVerifyGetKey;
  /** Mint a signed ID token. Defaults describe a normal, verified Google account. */
  signIdToken(claims: {
    sub: string;
    email: string;
    /** Defaults to true; set false to exercise the unverified-email refusal. */
    emailVerified?: boolean;
    /** Seconds from now until expiry. Negative values produce an already-expired token. */
    expiresInSeconds?: number;
    issuer?: string;
    audience?: string;
  }): Promise<string>;
  /** Sign with a DIFFERENT key than the published JWKS — an invalid-signature token. */
  signWithWrongKey(claims: { sub: string; email: string }): Promise<string>;
};

/** Spin up an in-process fake IdP. Call once per test file. */
export async function createTestIdp(audience = "test-client-id"): Promise<TestIdp> {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const impostor = await generateKeyPair("RS256");

  const publicJwk = await exportJWK(publicKey);
  const jwks: JSONWebKeySet = { keys: [{ ...publicJwk, kid: KID, alg: "RS256", use: "sig" }] };

  async function sign(
    key: SignKey,
    claims: Record<string, unknown>,
    opts: { issuer: string; audience: string; expiresInSeconds: number },
  ): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT(claims)
      .setProtectedHeader({ alg: "RS256", kid: KID })
      .setIssuedAt(now)
      .setIssuer(opts.issuer)
      .setAudience(opts.audience)
      .setExpirationTime(now + opts.expiresInSeconds)
      .sign(key);
  }

  return {
    issuer: ISSUER,
    audience,
    jwks,
    keys: createLocalJWKSet(jwks),
    signIdToken: (c) =>
      sign(
        privateKey,
        { sub: c.sub, email: c.email, email_verified: c.emailVerified ?? true },
        {
          issuer: c.issuer ?? ISSUER,
          audience: c.audience ?? audience,
          expiresInSeconds: c.expiresInSeconds ?? 3600,
        },
      ),
    signWithWrongKey: (c) =>
      sign(
        impostor.privateKey,
        { sub: c.sub, email: c.email, email_verified: true },
        { issuer: ISSUER, audience, expiresInSeconds: 3600 },
      ),
  };
}
