import { z } from "zod";

/** The ten grantable roles. `super_user` is included so the schema is total, but grantRole refuses it
 *  from any UI path (FR-030a) — the CLI is its only source. */
const role = z.enum([
  "door_attendant",
  "booker",
  "financial_secretary",
  "treasurer",
  "vice_president",
  "webmaster",
  "mailing_list_manager",
  "secretary",
  "president",
  "super_user",
]);

export const grantCreateSchema = z
  .object({
    subjectContactId: z.string().uuid(),
    role,
    // Scope: at most one. Omit both for club-wide. The DB CHECK backs this up.
    seriesKey: z.string().trim().min(1).optional(),
    groupId: z.string().uuid().optional(),
  })
  .refine((v) => !(v.seriesKey && v.groupId), {
    message: "A grant is scoped to a series OR a group, not both.",
  });

export const volunteerDesignateSchema = z.object({
  contactId: z.string().uuid(),
});

export type GrantCreateInput = z.infer<typeof grantCreateSchema>;
export type VolunteerDesignateInput = z.infer<typeof volunteerDesignateSchema>;
