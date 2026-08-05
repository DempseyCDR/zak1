import { z } from "zod";

export const seriesQboPutSchema = z.object({
  gateCustomer: z.string().trim().min(1),
  qboClass: z.string().trim().min(1),
});

export type SeriesQboPutInput = z.infer<typeof seriesQboPutSchema>;
