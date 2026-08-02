import { z } from "zod";
import { bookingCreateSchema } from "@/server/validation/performers";

/**
 * Feature 019 US2 (B28) + feature 023: recording an actual performer disbursement (a check).
 * `payeePerformerId` MAY differ from any settled performer (one check to a band lead). `lines` are the
 * per-booking allocation — each carries the amount applied to that booking; the check total is the sum of
 * its lines. Bookings MAY belong to different events (cross-event delayed checks — 023). Amounts are
 * dollars in, stored as integer cents. Every line settles a real booking (no-booking reimbursements are
 * out of scope → backlog B42).
 */
export const performerPaymentLineSchema = z.object({
  bookingId: z.string().uuid(),
  amount: z.number().min(0),
});

export const performerPaymentCreateSchema = z.object({
  eventId: z.string().uuid(), // recorded-at = the check-written date
  payeePerformerId: z.string().uuid(),
  checkNumber: z.string().min(1).optional(),
  overrideReason: z.string().min(1).optional(),
  replacesPaymentId: z.string().uuid().optional(), // set on a reissue → links to the voided check
  lines: z.array(performerPaymentLineSchema).min(1),
});

// PATCH: any subset; `lines` (when present) REPLACES the allocation. No top-level amount — the total is the
// sum of the lines. Voided payments are not patchable (correct via a reissue).
export const performerPaymentPatchSchema = z.object({
  checkNumber: z.string().min(1).nullable().optional(),
  overrideReason: z.string().min(1).nullable().optional(),
  lines: z.array(performerPaymentLineSchema).min(1).optional(),
});

// Void: a reason is required (the treasurer records the void).
export const performerPaymentVoidSchema = z.object({
  reason: z.string().min(1),
});

// Feature 030 (FR-011): add a last-minute performer at settlement (FS-gated, performer_payment.write). Only
// the performer + role — pay derives from the rate in createBooking; the FS never sets an arbitrary amount
// via this narrow path.
export const settlementPerformerSchema = bookingCreateSchema.pick({
  performerId: true,
  performerType: true,
});

export type PerformerPaymentLineInput = z.infer<typeof performerPaymentLineSchema>;
export type PerformerPaymentCreateInput = z.infer<typeof performerPaymentCreateSchema>;
export type PerformerPaymentPatchInput = z.infer<typeof performerPaymentPatchSchema>;
export type PerformerPaymentVoidInput = z.infer<typeof performerPaymentVoidSchema>;
export type SettlementPerformerInput = z.infer<typeof settlementPerformerSchema>;
