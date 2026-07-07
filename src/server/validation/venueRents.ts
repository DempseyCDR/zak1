import { z } from "zod";

// Venue rent: seriesKey omitted → venue default; seriesKey present → series-at-venue override.
export const venueRentCreateSchema = z.object({
  venueId: z.string().uuid(),
  seriesKey: z.string().min(1).optional(),
  amount: z.number().min(0),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "effectiveDate must be YYYY-MM-DD"),
});

export type VenueRentCreateInput = z.infer<typeof venueRentCreateSchema>;
