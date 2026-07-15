import { z } from "zod";

/**
 * Boundary validation for the Google sign-in flow (Constitution Principle III).
 *
 * Everything Google hands us is untrusted input until it has passed through here.
 */

/** OAuth callback query. Google returns `error` instead when the user declines. */
export const oauthCallbackSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});

export type OAuthCallbackInput = z.infer<typeof oauthCallbackSchema>;

/**
 * The claims we consume from a verified Google ID token.
 *
 * `email_verified` MUST be literally `true`. This is the linchpin of the whole design: without it an
 * ID token could assert an arbitrary unverified address and walk straight through the email→contact
 * match that grants staff access. `z.literal(true)` rejects `false`, missing, and any non-boolean.
 *
 * Signature, issuer, audience and expiry are checked by `jose` before this runs; this validates the
 * payload's shape and the one claim our authorisation decision depends on.
 */
export const idTokenClaimsSchema = z.object({
  // Google's immutable account id — the durable identity link (research R9).
  sub: z.string().min(1),
  email: z.string().email(),
  email_verified: z.literal(true),
});

/** A Google identity we have actually verified. Never construct this by hand outside the seam. */
export type VerifiedClaims = z.infer<typeof idTokenClaimsSchema>;

/**
 * Why a sign-in was refused. Server-side only: the user always sees one generic message (FR-009),
 * because distinguishing "not a volunteer" from "no such contact" would let any Google user probe
 * club membership.
 */
export type RefusalReason =
  | "token_invalid"
  | "email_unverified"
  | "no_match"
  | "ambiguous_match"
  | "not_volunteer"
  | "identity_exists"
  | "sub_email_mismatch";
