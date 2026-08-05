import { z } from "zod";

export const accountMappingPutSchema = z.object({
  accountCode: z.string().trim().min(1),
  accountName: z.string().trim().min(1),
});

export const seriesQboPutSchema = z.object({
  gateCustomer: z.string().trim().min(1),
  qboClass: z.string().trim().min(1),
});

export type AccountMappingPutInput = z.infer<typeof accountMappingPutSchema>;
export type SeriesQboPutInput = z.infer<typeof seriesQboPutSchema>;
