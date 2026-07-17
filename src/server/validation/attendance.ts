import { z } from "zod";

// Feature 017: fields shared by the two "real person" check-in paths (existing contact / new contact).
// B35 children count + B36 open-band flag ride on a check-in of an actual person, never on `unmatched`.
const checkinExtras = {
  childrenCount: z.number().int().min(0).optional(),
  isOpenBand: z.boolean().optional(),
};

export const attendanceSchema = z.union([
  z.object({ contactId: z.string().uuid(), ...checkinExtras }),
  z.object({
    newContact: z.object({
      firstName: z.string().trim().min(1),
      lastName: z.string().trim().min(1).optional(),
      // Feature 017 (B34): the Door Attendant may edit the derived "first last" display name.
      displayNameOverride: z.string().trim().min(1).optional(),
      email: z.string().trim().email().optional(),
      phone: z.string().trim().min(1).optional(),
    }),
    ...checkinExtras,
  }),
  // `.strict()` so a children count / open-band flag on an unmatched placeholder is rejected, not
  // silently dropped (feature 017): those belong to a real person's check-in.
  z.object({ unmatched: z.literal(true) }).strict(),
]);

export type AttendanceInput = z.infer<typeof attendanceSchema>;
