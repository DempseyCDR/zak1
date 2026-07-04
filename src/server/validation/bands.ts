import { z } from "zod";

const memberSchema = z.object({
  performerId: z.string().uuid(),
  isLead: z.boolean(),
});

/** A roster must have ≥1 member and exactly one lead. */
function exactlyOneLead(members: { isLead: boolean }[], ctx: z.RefinementCtx) {
  if (members.length < 1) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "a band needs at least one member (the lead)" });
    return;
  }
  const leads = members.filter((m) => m.isLead).length;
  if (leads !== 1) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "a band must have exactly one lead musician" });
  }
}

export const bandCreateSchema = z.object({
  name: z.string().trim().min(1),
  bio: z.string().optional(),
  photoUrl: z.string().url().optional(),
  members: z.array(memberSchema).superRefine(exactlyOneLead),
});

export const bandPatchSchema = z.object({
  name: z.string().trim().min(1).optional(),
  bio: z.string().nullable().optional(),
  photoUrl: z.string().url().nullable().optional(),
  members: z.array(memberSchema).superRefine(exactlyOneLead).optional(),
});

export const bookBandSchema = z.object({
  bandId: z.string().uuid(),
  memberPay: z.array(z.object({ performerId: z.string().uuid(), amount: z.number().min(0) })).optional(),
});

export type BandCreateInput = z.infer<typeof bandCreateSchema>;
export type BandPatchInput = z.infer<typeof bandPatchSchema>;
export type BookBandInput = z.infer<typeof bookBandSchema>;
