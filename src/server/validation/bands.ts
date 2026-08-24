import { z } from "zod";
import { promoLinksSchema, stylesSchema } from "@/server/domain/public/promoLinks";

const memberSchema = z.object({
  performerId: z.string().uuid(),
  isLead: z.boolean(),
  // Feature 053 (P7-R9): optional instrument, shown on the roster/lineup.
  instrument: z.string().trim().min(1).nullable().optional(),
});

/** A roster must have ≥1 member and exactly one lead. */
function exactlyOneLead(members: { isLead: boolean }[], ctx: z.RefinementCtx) {
  if (members.length < 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "a band needs at least one member (the lead)",
    });
    return;
  }
  const leads = members.filter((m) => m.isLead).length;
  if (leads !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "a band must have exactly one lead musician",
    });
  }
}

export const bandCreateSchema = z.object({
  name: z.string().trim().min(1),
  bio: z.string().optional(),
  photoUrl: z.string().url().optional(),
  members: z.array(memberSchema).superRefine(exactlyOneLead),
  // Feature 053 (P7-R9): public roster fields.
  isPublic: z.boolean().optional(),
  styles: stylesSchema.optional(),
  links: promoLinksSchema.optional(),
});

export const bandPatchSchema = z.object({
  name: z.string().trim().min(1).optional(),
  bio: z.string().nullable().optional(),
  photoUrl: z.string().url().nullable().optional(),
  members: z.array(memberSchema).superRefine(exactlyOneLead).optional(),
  // Feature 053 (P7-R9): public roster fields (replace the set when present).
  isPublic: z.boolean().optional(),
  styles: stylesSchema.optional(),
  links: promoLinksSchema.optional(),
});

export const bookBandSchema = z.object({
  bandId: z.string().uuid(),
  memberPay: z
    .array(z.object({ performerId: z.string().uuid(), amount: z.number().min(0) }))
    .optional(),
});

// Feature 024 US2: re-point an event's band to a different one.
export const repointBandSchema = z.object({
  fromBandId: z.string().uuid(),
  toBandId: z.string().uuid(),
});

export type BandCreateInput = z.infer<typeof bandCreateSchema>;
export type RepointBandInput = z.infer<typeof repointBandSchema>;
export type BandPatchInput = z.infer<typeof bandPatchSchema>;
export type BookBandInput = z.infer<typeof bookBandSchema>;
