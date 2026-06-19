import { z } from "zod";

const emailPurpose = z.enum(["personal", "booking", "public_profile", "other"]);
const emailStatus = z.enum(["active", "transition", "inactive"]);
const consentTopic = z.enum([
  "contra",
  "english",
  "openband",
  "special_events",
  "jane_austen_ball",
  "contact_tracing",
  "do_not_contact",
]);
const volunteerRole = z.enum(["door_attendant", "administrator"]);

// Reject any read-only provider_* fields supplied by clients (FR-006).
const noProviderFields = (obj: Record<string, unknown>, ctx: z.RefinementCtx) => {
  for (const key of Object.keys(obj)) {
    if (key.startsWith("provider")) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `read-only field: ${key}`, path: [key] });
    }
  }
};

export const emailCreateSchema = z
  .object({
    address: z.string().email(),
    purposes: z.array(emailPurpose).nonempty().default(["personal"]),
    consentTopics: z.array(consentTopic).nonempty().default(["contact_tracing"]),
    status: emailStatus.default("active"),
    isLogin: z.boolean().default(false),
  })
  .passthrough()
  .superRefine(noProviderFields);

export const contactCreateSchema = z.object({
  displayName: z.string().trim().min(1),
  email: emailCreateSchema,
});

export const contactPatchSchema = z.object({
  displayName: z.string().trim().min(1).optional(),
  isVolunteer: z.boolean().optional(),
  volunteerRoles: z.array(volunteerRole).optional(),
});

export const emailAddSchema = emailCreateSchema;

export const emailPatchSchema = z
  .object({
    purposes: z.array(emailPurpose).nonempty().optional(),
    consentTopics: z.array(consentTopic).nonempty().optional(),
    status: emailStatus.optional(),
    isLogin: z.boolean().optional(),
  })
  .passthrough()
  .superRefine(noProviderFields);

export type ContactCreateInput = z.infer<typeof contactCreateSchema>;
export type ContactPatchInput = z.infer<typeof contactPatchSchema>;
export type EmailAddInput = z.infer<typeof emailAddSchema>;
export type EmailPatchInput = z.infer<typeof emailPatchSchema>;
