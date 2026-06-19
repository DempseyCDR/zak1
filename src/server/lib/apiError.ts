/** Consistent API error shape: { error: { code, message } }. */
export type ApiErrorCode =
  | "EMAIL_DUPLICATE"
  | "CONTACT_NOT_FOUND"
  | "EMAIL_NOT_FOUND"
  | "LOGIN_NOT_PERMITTED"
  | "PURPOSES_REQUIRED"
  | "CONSENT_TOPICS_REQUIRED"
  | "ROLES_REQUIRE_VOLUNTEER"
  | "READ_ONLY_FIELD"
  | "VALIDATION_ERROR";

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;

  constructor(code: ApiErrorCode, status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }

  toResponseBody(): { error: { code: ApiErrorCode; message: string } } {
    return { error: { code: this.code, message: this.message } };
  }
}

export const errors = {
  emailDuplicate: () =>
    new ApiError("EMAIL_DUPLICATE", 409, "Email already in use by an active or transition record."),
  contactNotFound: () => new ApiError("CONTACT_NOT_FOUND", 404, "Contact not found."),
  emailNotFound: () => new ApiError("EMAIL_NOT_FOUND", 404, "Email not found."),
  loginNotPermitted: () =>
    new ApiError(
      "LOGIN_NOT_PERMITTED",
      422,
      "A login email may only be set on a volunteer contact (Phase 1).",
    ),
  purposesRequired: () =>
    new ApiError("PURPOSES_REQUIRED", 422, "At least one email purpose is required."),
  consentTopicsRequired: () =>
    new ApiError("CONSENT_TOPICS_REQUIRED", 422, "At least one consent topic is required."),
  rolesRequireVolunteer: () =>
    new ApiError(
      "ROLES_REQUIRE_VOLUNTEER",
      422,
      "Volunteer roles may only be assigned to a volunteer contact.",
    ),
  readOnlyField: (field: string) =>
    new ApiError("READ_ONLY_FIELD", 422, `Field is read-only: ${field}.`),
  validation: (message: string) => new ApiError("VALIDATION_ERROR", 422, message),
};
