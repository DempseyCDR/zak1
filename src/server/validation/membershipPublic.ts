import { z } from "zod";

/**
 * Feature 019 US3 (FR-010): the public membership capture form. Deliberately minimal — only what a member
 * needs to enter (FR-016). `email` is the key the PayPal webhook matches against (case-insensitively).
 */
export const membershipCaptureSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

export type MembershipCaptureInput = z.infer<typeof membershipCaptureSchema>;
