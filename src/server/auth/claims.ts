import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { idTokenClaimsSchema, type VerifiedClaims } from "@/server/validation/auth";
import { getAuthEnv } from "@/server/validation/env";

/**
 * The Google boundary seam (feature 015).
 *
 * This is the ONLY place an external identity assertion becomes trusted data. Everything behind it —
 * email→contact matching, the is_volunteer gate, session creation — is our own logic and is tested
 * against real infrastructure.
 *
 * The verifier is a parameter so tests can supply a LOCAL key set and never contact Google
 * (constitution v1.2.0). Production callers omit it and get Google's remote JWKS.
 */

const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
// Google mints tokens with either form of the issuer claim.
const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

export type IdTokenVerifier = {
  /** A key RESOLVER — `createRemoteJWKSet` in production, `createLocalJWKSet` in tests. */
  jwks: JWTVerifyGetKey;
  issuer: string | string[];
  audience: string;
};

export type ClaimsResult =
  | { ok: true; claims: VerifiedClaims }
  | { ok: false; reason: "token_invalid" | "email_unverified" };

let cachedGoogleJwks: JWTVerifyGetKey | null = null;

/** Google's real verifier. Lazy: constructing it needs OAuth config the test suite does not have. */
export function googleVerifier(): IdTokenVerifier {
  cachedGoogleJwks ??= createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));
  return {
    jwks: cachedGoogleJwks,
    issuer: GOOGLE_ISSUERS,
    audience: getAuthEnv().GOOGLE_CLIENT_ID,
  };
}

/**
 * Verify a Google ID token and extract the claims we act on.
 *
 * Signature, issuer, audience and expiry are checked by `jose`; `email_verified === true` is checked
 * explicitly because it is the claim the entire access decision rests on.
 */
export async function verifyGoogleIdToken(
  token: string,
  verifier: IdTokenVerifier = googleVerifier(),
): Promise<ClaimsResult> {
  let payload: Record<string, unknown>;
  try {
    const verified = await jwtVerify(token, verifier.jwks, {
      issuer: verifier.issuer,
      audience: verifier.audience,
    });
    payload = verified.payload as Record<string, unknown>;
  } catch {
    // Bad signature, wrong issuer/audience, expired, or malformed — all indistinguishable to the
    // user, and all equally a refusal.
    return { ok: false, reason: "token_invalid" };
  }

  // Checked before shape parsing so an unverified address is reported as exactly that, rather than
  // as a generic malformed token.
  if (payload.email_verified !== true) return { ok: false, reason: "email_unverified" };

  const parsed = idTokenClaimsSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, reason: "token_invalid" };

  return { ok: true, claims: parsed.data };
}
