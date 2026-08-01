import { z } from "zod";

const performerType = z.enum([
  "caller",
  "lead_musician",
  "musician",
  "open_band_musician",
  "sound_tech",
  "instructor",
]);

// Feature 026 (R5-P1): capture STRUCTURED names (first/last/display) when a performer needs a new contact —
// the same shape the directory (012) and check-in (017) use — instead of a single free-typed name that landed
// whole in first_name. Either link an existing contact (contactId) OR create one (firstName), never both/neither.
export const performerCreateSchema = z
  .object({
    // Create path: seed the auto-created contact's structured name.
    firstName: z.string().trim().min(1).optional(),
    lastName: z.string().trim().min(1).optional(),
    displayNameOverride: z.string().trim().min(1).optional(),
    // Link path: attach an existing contact instead of creating one.
    contactId: z.string().uuid().optional(),
    // Optional, only used on the create path to seed the contact (FR-015).
    email: z.string().trim().email().optional(),
    // Feature 020: purpose to label the seeded email with (the booking add-performer flow passes "booking";
    // defaults to "personal" for other callers).
    emailPurpose: z.enum(["personal", "booking", "public_profile", "other"]).optional(),
    phone: z.string().trim().min(1).optional(),
    bio: z.string().optional(),
    photoUrl: z.string().url().optional(),
  })
  .refine((v) => (v.contactId != null) !== (v.firstName != null), {
    message:
      "Provide either a contactId (to link) or a firstName (to create) — not both or neither.",
  });

export const performerPatchSchema = z.object({
  displayName: z.string().trim().min(1).optional(),
  contactId: z.string().uuid().nullable().optional(),
  bio: z.string().nullable().optional(),
  photoUrl: z.string().url().nullable().optional(),
});

export const rateParameterCreateSchema = z.object({
  seriesKey: z.string().min(1),
  kind: z.enum(["caller", "sound_tech", "musician"]),
  amount: z.number().min(0),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "effectiveDate must be YYYY-MM-DD"),
});

export const bookingCreateSchema = z.object({
  performerId: z.string().uuid(),
  performerType,
  pay: z.number().min(0).optional(),
  isDonated: z.boolean().optional(),
  note: z.string().optional(),
});

export const bookingPatchSchema = z.object({
  pay: z.number().min(0).optional(),
  isDonated: z.boolean().optional(),
  note: z.string().nullable().optional(),
  // Feature 018 (B23): advance/decline the lifecycle, or re-point the slot to a different performer.
  status: z.enum(["proposed", "requested", "tentative", "confirmed", "declined"]).optional(),
  performerId: z.string().uuid().optional(),
});

// Feature 024 US3: substitute a performer on a booking (branches on the written-check discriminator).
export const substitutePerformerSchema = z.object({
  newPerformerId: z.string().uuid(),
});

export type PerformerCreateInput = z.infer<typeof performerCreateSchema>;
export type SubstitutePerformerInput = z.infer<typeof substitutePerformerSchema>;
export type PerformerPatchInput = z.infer<typeof performerPatchSchema>;
export type RateParameterCreateInput = z.infer<typeof rateParameterCreateSchema>;
export type BookingCreateInput = z.infer<typeof bookingCreateSchema>;
export type BookingPatchInput = z.infer<typeof bookingPatchSchema>;
