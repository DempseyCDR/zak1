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

// Email and phone are both optional — a dancer may decline to give either — but
// callers should warn (not block) when neither is present.
// Structured names (feature 012): first name required, last name optional (dancers may decline one),
// display-name override + pronouns optional.
export const contactCreateSchema = z.object({
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1).optional(),
  displayNameOverride: z.string().trim().min(1).optional(),
  pronouns: z.string().trim().min(1).optional(),
  email: emailCreateSchema.optional(),
  phone: z.string().trim().min(1).optional(),
});

export const contactPatchSchema = z.object({
  firstName: z.string().trim().min(1).optional(),
  lastName: z.string().trim().min(1).nullable().optional(),
  displayNameOverride: z.string().trim().min(1).nullable().optional(),
  pronouns: z.string().trim().min(1).nullable().optional(),
  phone: z.string().trim().min(1).nullable().optional(),
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
