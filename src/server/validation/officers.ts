import { z } from "zod";

// Feature 055 (P7-R12): assign (or clear) the contact holding a board-seat role. The service enforces that
// `roleKey` is a board-seat key in the committed registry; a null contactId clears the seat.
export const officerSetSchema = z.object({
  roleKey: z.string().trim().min(1),
  contactId: z.string().uuid().nullable(),
});

export type OfficerSetInput = z.infer<typeof officerSetSchema>;
