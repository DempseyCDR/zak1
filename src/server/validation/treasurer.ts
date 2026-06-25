import { z } from "zod";

export const accountMappingPutSchema = z.object({
  accountCode: z.string().trim().min(1),
  accountName: z.string().trim().min(1),
});

export const seriesQboPutSchema = z.object({
  gateCustomer: z.string().trim().min(1),
  qboClass: z.string().trim().min(1),
});

export const nonDanceIncomeCreateSchema = z.object({
  description: z.string().trim().min(1),
  amount: z.number().min(0),
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "entryDate must be YYYY-MM-DD"),
});

export const checkNumberPatchSchema = z.object({
  checkNumber: z.string().trim().min(1).nullable(),
});

export type AccountMappingPutInput = z.infer<typeof accountMappingPutSchema>;
export type SeriesQboPutInput = z.infer<typeof seriesQboPutSchema>;
export type NonDanceIncomeCreateInput = z.infer<typeof nonDanceIncomeCreateSchema>;
export type CheckNumberPatchInput = z.infer<typeof checkNumberPatchSchema>;
