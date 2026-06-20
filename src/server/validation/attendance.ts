import { z } from "zod";

export const attendanceSchema = z.union([
  z.object({ contactId: z.string().uuid() }),
  z.object({
    newContact: z.object({ displayName: z.string().trim().min(1), email: z.string().email() }),
  }),
  z.object({ unmatched: z.literal(true) }),
]);

export type AttendanceInput = z.infer<typeof attendanceSchema>;
