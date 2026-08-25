import { z } from "zod";

// Feature 054 (P7-R10): admission-pricing write boundary. A revision is a non-empty set of labeled tiers
// sharing one effective date; a tier amount is a whole number of cents ≥ 0 (0 = free, e.g. musicians).
export const admissionTierInputSchema = z.object({
  label: z.string().trim().min(1, "a tier needs a label"),
  amountCents: z.number().int().min(0, "amount must be ≥ 0"),
});

export const admissionPricingSetSchema = z.object({
  seriesId: z.string().uuid(),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "effectiveDate must be YYYY-MM-DD"),
  tiers: z.array(admissionTierInputSchema).min(1, "at least one tier is required"),
});

export const scheduleSentenceSchema = z.object({
  seriesId: z.string().uuid(),
  sentence: z.string().trim().min(1).nullable(),
});

export type AdmissionPricingSetInput = z.infer<typeof admissionPricingSetSchema>;
export type ScheduleSentenceInput = z.infer<typeof scheduleSentenceSchema>;
