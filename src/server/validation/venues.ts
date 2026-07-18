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
  // Feature 018 (B22): optional landlord contact (the party the Booker negotiates rent with); null clears.
  landlordContactId: z.string().uuid().nullable().optional(),
});

// Event PATCH (feature 007 venue assignment; 011 per-event rent; 013 label/start time/description).
// Every field optional: only the keys present are applied. `null` clears.
export const assignVenueSchema = z.object({
  venueId: z.string().uuid().nullable().optional(),
  rentCents: z.number().int().min(0).nullable().optional(),
  label: z.string().trim().min(1).nullable().optional(),
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "startTime must be HH:MM")
    .nullable()
    .optional(),
  description: z.string().trim().min(1).nullable().optional(),
  // Feature 018: reschedule (B25, event.write), cancel/revive (B25, event.write), advertised price
  // (B27, event.public.write). Field-level authorization is enforced by `assertFields` in the route.
  eventDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "eventDate must be YYYY-MM-DD")
    .optional(),
  status: z.enum(["scheduled", "cancelled"]).optional(),
  advertisedPriceCents: z.number().int().min(0).nullable().optional(),
});

export type VenueCreateInput = z.infer<typeof venueCreateSchema>;
export type VenuePatchInput = z.infer<typeof venuePatchSchema>;
export type AssignVenueInput = z.infer<typeof assignVenueSchema>;
