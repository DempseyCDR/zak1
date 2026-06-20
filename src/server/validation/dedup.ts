import { z } from "zod";

export const mergeSchema = z.object({
  canonicalId: z.string().uuid(),
  mergedId: z.string().uuid(),
});

export type MergeInput = z.infer<typeof mergeSchema>;
