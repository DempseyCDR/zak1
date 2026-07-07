import { z } from "zod";

export const venueCreateSchema = z.object({
  name: z.string().trim().min(1),
  address: z.string().trim().min(1),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export const venuePatchSchema = z.object({
  name: z.string().trim().min(1).optional(),
  address: z.string().trim().min(1).optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
});

// Event PATCH (feature 007 venue assignment; feature 011 adds the per-event rent override).
// Both fields optional: only the keys present are applied. `null` clears (venue / rent override).
export const assignVenueSchema = z.object({
  venueId: z.string().uuid().nullable().optional(),
  rentCents: z.number().int().min(0).nullable().optional(),
});

export type VenueCreateInput = z.infer<typeof venueCreateSchema>;
export type VenuePatchInput = z.infer<typeof venuePatchSchema>;
export type AssignVenueInput = z.infer<typeof assignVenueSchema>;
