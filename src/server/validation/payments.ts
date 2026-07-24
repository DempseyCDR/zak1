import { z } from "zod";

/**
 * Feature 019 US2 (B28): recording an actual performer disbursement. `payeePerformerId` MAY differ from
 * any booked performer (substitution); `bookingIds` is the set of obligations this payment settles
 * (aggregation — one check across several). Amounts are dollars in, stored as integer cents.
 */
export const performerPaymentCreateSchema = z.object({
  eventId: z.string().uuid(),
  payeePerformerId: z.string().uuid(),
  amount: z.number().min(0),
  checkNumber: z.string().min(1).optional(),
  overrideReason: z.string().min(1).optional(),
  // At least one booking — every payment settles a booking (Clarifications 2026-07-23; no-booking
  // reimbursements are out of scope → backlog B42).
  bookingIds: z.array(z.string().uuid()).min(1),
});

// PATCH: any subset; bookingIds (when present) REPLACES the link set.
export const performerPaymentPatchSchema = z.object({
  amount: z.number().min(0).optional(),
  checkNumber: z.string().min(1).nullable().optional(),
  overrideReason: z.string().min(1).nullable().optional(),
  bookingIds: z.array(z.string().uuid()).min(1).optional(),
});

export type PerformerPaymentCreateInput = z.infer<typeof performerPaymentCreateSchema>;
export type PerformerPaymentPatchInput = z.infer<typeof performerPaymentPatchSchema>;
