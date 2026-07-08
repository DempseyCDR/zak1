import { z } from "zod";

export const attendanceSchema = z.union([
  z.object({ contactId: z.string().uuid() }),
  z.object({
    newContact: z.object({
      firstName: z.string().trim().min(1),
      lastName: z.string().trim().min(1).optional(),
      email: z.string().trim().email().optional(),
      phone: z.string().trim().min(1).optional(),
    }),
  }),
  z.object({ unmatched: z.literal(true) }),
]);

export type AttendanceInput = z.infer<typeof attendanceSchema>;
