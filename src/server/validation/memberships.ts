import { z } from "zod";

export const membershipCreateSchema = z.object({
  contactId: z.string().uuid(),
  payerId: z.string().uuid(),
  // ISO calendar date (YYYY-MM-DD).
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expiryDate must be YYYY-MM-DD"),
});

export type MembershipCreateInput = z.infer<typeof membershipCreateSchema>;
