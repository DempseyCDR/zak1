import { z } from "zod";

const performerType = z.enum([
  "caller",
  "lead_musician",
  "musician",
  "open_band_musician",
  "sound_tech",
  "instructor",
]);

export const performerCreateSchema = z.object({
  displayName: z.string().trim().min(1),
  contactId: z.string().uuid().optional(),
  // Only used when contactId is omitted, to seed the auto-created contact (FR-015).
  email: z.string().trim().email().optional(),
  phone: z.string().trim().min(1).optional(),
  bio: z.string().optional(),
  photoUrl: z.string().url().optional(),
});

export const performerPatchSchema = z.object({
  displayName: z.string().trim().min(1).optional(),
  contactId: z.string().uuid().nullable().optional(),
  bio: z.string().nullable().optional(),
  photoUrl: z.string().url().nullable().optional(),
});

export const rateParameterCreateSchema = z.object({
  kind: z.enum(["caller", "sound_tech"]),
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
});

export type PerformerCreateInput = z.infer<typeof performerCreateSchema>;
export type PerformerPatchInput = z.infer<typeof performerPatchSchema>;
export type RateParameterCreateInput = z.infer<typeof rateParameterCreateSchema>;
export type BookingCreateInput = z.infer<typeof bookingCreateSchema>;
export type BookingPatchInput = z.infer<typeof bookingPatchSchema>;
