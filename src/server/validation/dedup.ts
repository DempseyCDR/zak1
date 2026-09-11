import { z } from "zod";

export const mergeSchema = z.object({
  canonicalId: z.string().uuid(),
  mergedId: z.string().uuid(),
});

/** Feature 069 (FR-002): mark a pair "not duplicates". Ids may arrive in either order. */
export const rejectionSchema = z.object({
  contactAId: z.string().uuid(),
  contactBId: z.string().uuid(),
});

/**
 * Resolve a held merge by choosing which of the colliding things survives. Exactly one KIND of choice,
 * matching the hold's reason — a login choice cannot resolve an account collision.
 *
 * Feature 072 (FR-012a) corrects the sign-in choice. Feature 069 accepted `survivingLoginEmailId` alone,
 * and acting on it set `contact_emails.is_login` — a LABEL — while leaving `staff_identities` untouched.
 * Access follows the account binding, not the label, and feature 015 (R9) deliberately allows the two to
 * disagree because a Google account can be renamed without telling us. So the officer answering "which
 * sign-in survives?" was changing something that did not decide it. Both fields are now required
 * together, and an address on its own must not parse.
 */
export const heldResolveSchema = z
  .object({
    survivingIdentityId: z.string().uuid().optional(),
    survivingLoginEmailId: z.string().uuid().optional(),
    survivingAccountId: z.string().uuid().optional(),
    /** Feature 072 (FR-009): which of the merged contact's grants move. Empty means "none" — valid. */
    keepGrantIds: z.array(z.string().uuid()).optional(),
  })
  .refine((v) => !v.survivingLoginEmailId === !v.survivingIdentityId, {
    message:
      "a surviving sign-in needs both survivingIdentityId and survivingLoginEmailId: the address is a " +
      "label, the identity is what grants access",
  })
  .refine(
    (v) =>
      [!!v.survivingIdentityId, !!v.survivingAccountId, !!v.keepGrantIds].filter(Boolean).length ===
      1,
    {
      message:
        "exactly one kind of choice is required: a surviving sign-in, a surviving account, or the " +
        "grants to keep",
    },
  );

export type MergeInput = z.infer<typeof mergeSchema>;
export type RejectionInput = z.infer<typeof rejectionSchema>;
export type HeldResolveInput = z.infer<typeof heldResolveSchema>;
