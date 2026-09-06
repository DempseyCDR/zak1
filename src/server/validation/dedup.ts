import { z } from "zod";

export const mergeSchema = z.object({
  canonicalId: z.string().uuid(),
  mergedId: z.string().uuid(),
  // Feature 069 (FR-012): a role.assign holder may resolve a two-login collision in the same step.
  survivingLoginEmailId: z.string().uuid().optional(),
});

/** Feature 069 (FR-002): mark a pair "not duplicates". Ids may arrive in either order. */
export const rejectionSchema = z.object({
  contactAId: z.string().uuid(),
  contactBId: z.string().uuid(),
});

/**
 * Feature 069 (FR-012): resolve a held merge by choosing which of the colliding things survives.
 * Exactly one choice, matching the hold's reason — a login choice cannot resolve an account collision.
 */
export const heldResolveSchema = z
  .object({
    survivingLoginEmailId: z.string().uuid().optional(),
    survivingAccountId: z.string().uuid().optional(),
  })
  .refine((v) => !!v.survivingLoginEmailId !== !!v.survivingAccountId, {
    message: "exactly one of survivingLoginEmailId or survivingAccountId is required",
  });

export type MergeInput = z.infer<typeof mergeSchema>;
export type RejectionInput = z.infer<typeof rejectionSchema>;
export type HeldResolveInput = z.infer<typeof heldResolveSchema>;
