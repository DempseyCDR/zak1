import { z } from "zod";
import { membershipLevelEnum } from "@/server/db/schema/enums";

/**
 * Feature 068: dues are recorded against a PAYER at a chosen level on a payment date. The expiry is
 * derived (FR-002), and the payer indirection is gone — the payer IS the contact (FR-001).
 */
export const membershipCreateSchema = z.object({
  contactId: z.string().uuid(),
  level: z.enum(membershipLevelEnum.enumValues),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "paymentDate must be YYYY-MM-DD"),
});

export type MembershipCreateInput = z.infer<typeof membershipCreateSchema>;

// Feature 068: the level is CHOSEN, never derived from an amount (FR-003) — tiers change and cheques
// bundle donations, so money and level are independent facts.
const membershipLevel = z.enum(membershipLevelEnum.enumValues);

/** Record a dues payment against a payer's account (FR-002/FR-003). Expiry is derived, never supplied. */
export const membershipPaymentSchema = z.object({
  level: membershipLevel,
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "paymentDate must be YYYY-MM-DD"),
});

/** Attach or detach a member on the payer's account (FR-008/FR-022). */
export const accountMemberSchema = z.object({ contactId: z.string().uuid() });

/** Change an account's level (FR-023), subject to the capacity rule. */
export const accountLevelSchema = z.object({ level: membershipLevel });

export type MembershipPaymentInput = z.infer<typeof membershipPaymentSchema>;
export type AccountMemberInput = z.infer<typeof accountMemberSchema>;
export type AccountLevelInput = z.infer<typeof accountLevelSchema>;
