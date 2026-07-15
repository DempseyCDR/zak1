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
  | "ALREADY_MERGED"
  | "SAME_CONTACT"
  | "SERIES_NOT_FOUND"
  | "EVENT_GROUP_NOT_FOUND"
  | "EVENT_NOT_FOUND"
  | "DOOR_RECORD_EXISTS"
  | "DOOR_RECORD_NOT_FOUND"
  | "ALREADY_CHECKED_IN"
  | "CASH_PAYOUT_REASON_REQUIRED"
  | "PERFORMER_NOT_FOUND"
  | "BOOKING_NOT_FOUND"
  | "SOUND_TECH_NOT_ALLOWED"
  | "MAPPING_KEY_NOT_FOUND"
  | "MAILING_LIST_NOT_FOUND"
  | "BAND_NOT_FOUND"
  | "VENUE_NOT_FOUND"
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED";

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
  /** Feature 015: no valid staff session. Deliberately says nothing about why. */
  unauthenticated: () => new ApiError("UNAUTHENTICATED", 401, "Authentication required."),
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
  alreadyMerged: () =>
    new ApiError("ALREADY_MERGED", 409, "One of the contacts has already been merged."),
  sameContact: () =>
    new ApiError("SAME_CONTACT", 422, "Canonical and merged contacts must differ."),
  validation: (message: string) => new ApiError("VALIDATION_ERROR", 422, message),
  seriesNotFound: () => new ApiError("SERIES_NOT_FOUND", 404, "Series not found."),
  eventGroupNotFound: () => new ApiError("EVENT_GROUP_NOT_FOUND", 404, "Event group not found."),
  eventNotFound: () => new ApiError("EVENT_NOT_FOUND", 404, "Event not found."),
  doorRecordExists: () =>
    new ApiError("DOOR_RECORD_EXISTS", 409, "This event already has a door record."),
  doorRecordNotFound: () => new ApiError("DOOR_RECORD_NOT_FOUND", 404, "Door record not found."),
  alreadyCheckedIn: () =>
    new ApiError("ALREADY_CHECKED_IN", 409, "This contact is already recorded for this event."),
  cashPayoutReasonRequired: () =>
    new ApiError("CASH_PAYOUT_REASON_REQUIRED", 422, "A reason is required for cash paid out."),
  performerNotFound: () => new ApiError("PERFORMER_NOT_FOUND", 404, "Performer not found."),
  bookingNotFound: () => new ApiError("BOOKING_NOT_FOUND", 404, "Booking not found."),
  soundTechNotAllowed: () =>
    new ApiError(
      "SOUND_TECH_NOT_ALLOWED",
      422,
      "Sound Tech is not allowed for this event's series.",
    ),
  mappingKeyNotFound: () =>
    new ApiError("MAPPING_KEY_NOT_FOUND", 404, "Unknown account-mapping line key."),
  mailingListNotFound: () => new ApiError("MAILING_LIST_NOT_FOUND", 404, "Unknown mailing list."),
  bandNotFound: () => new ApiError("BAND_NOT_FOUND", 404, "Band not found."),
  venueNotFound: () => new ApiError("VENUE_NOT_FOUND", 404, "Venue not found."),
};
