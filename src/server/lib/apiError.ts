/** Consistent API error shape: { error: { code, message } }. */
export type ApiErrorCode =
  | "EMAIL_DUPLICATE"
  | "CONTACT_NOT_FOUND"
  | "EMAIL_NOT_FOUND"
  | "LOGIN_NOT_PERMITTED"
  | "PURPOSES_REQUIRED"
  | "CONSENT_TOPICS_REQUIRED"
  | "READ_ONLY_FIELD"
  | "ALREADY_MERGED"
  | "SAME_CONTACT"
  | "SERIES_NOT_FOUND"
  | "EVENT_GROUP_NOT_FOUND"
  | "EVENT_NOT_FOUND"
  | "DOOR_RECORD_EXISTS"
  | "DOOR_RECORD_NOT_FOUND"
  | "ATTENDANCE_NOT_FOUND"
  | "ALREADY_CHECKED_IN"
  | "CASH_PAYOUT_REASON_REQUIRED"
  | "PERFORMER_NOT_FOUND"
  | "BOOKING_NOT_FOUND"
  | "SOUND_TECH_NOT_ALLOWED"
  | "MAILING_LIST_NOT_FOUND"
  | "BAND_NOT_FOUND"
  | "VENUE_NOT_FOUND"
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "UNAUTHORIZED"
  | "FIELD_NOT_PERMITTED"
  | "EXCLUSIVE_ROLE_CONFLICT"
  | "GRANT_REQUIRES_VOLUNTEER"
  | "ROLE_NOT_UI_GRANTABLE"
  | "GRANT_NOT_FOUND"
  | "EVENT_HAS_HISTORY"
  | "EVENT_HAS_ATTENDANCE"
  | "RECURRENCE_TOO_LARGE"
  | "PERFORMER_PAYMENT_NOT_FOUND"
  | "BOOKING_EVENT_MISMATCH";

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  /** For UNAUTHORIZED / FIELD_NOT_PERMITTED: the capability or field refused, for the audit trail. */
  readonly detail?: string;

  constructor(code: ApiErrorCode, status: number, message: string, detail?: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.detail = detail;
  }

  toResponseBody(): { error: { code: ApiErrorCode; message: string; detail?: string } } {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.detail !== undefined ? { detail: this.detail } : {}),
      },
    };
  }
}

export const errors = {
  /** Feature 015: no valid staff session. Deliberately says nothing about why. */
  unauthenticated: () => new ApiError("UNAUTHENTICATED", 401, "Authentication required."),
  /**
   * Feature 016: signed in, but not permitted (FR-026).
   *
   * NAMES the capability — the opposite posture to `unauthenticated` above, and deliberately so. 401
   * is silent because anyone could probe it without signing in. A 403's actor is a known volunteer
   * who, under FR-015, could already READ the thing they were refused: concealing the reason protects
   * nothing and only costs them the ability to understand what happened. The one carve-out is
   * FR-026a — a refusal must never echo or partially render contact PII.
   */
  unauthorized: (capability: string) =>
    new ApiError("UNAUTHORIZED", 403, `Not permitted: ${capability}.`, capability),
  /**
   * Feature 016: the write contained a field this actor does not own (FR-021/FR-022).
   *
   * The whole write is REFUSED, never stripped. Zod's instinct — drop unknown keys and carry on — is
   * the exact failure FR-022 forbids: a Webmaster who submits a date change must be told, not quietly
   * ignored.
   */
  fieldNotPermitted: (field: string) =>
    new ApiError("FIELD_NOT_PERMITTED", 403, `Field not permitted: ${field}.`, field),
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
  readOnlyField: (field: string) =>
    new ApiError("READ_ONLY_FIELD", 422, `Field is read-only: ${field}.`),
  alreadyMerged: () =>
    new ApiError("ALREADY_MERGED", 409, "One of the contacts has already been merged."),
  sameContact: () =>
    new ApiError("SAME_CONTACT", 422, "Canonical and merged contacts must differ."),
  validation: (message: string) => new ApiError("VALIDATION_ERROR", 422, message),
  /**
   * FR-005a: President / VP / Treasurer are mutually exclusive — separation of authority from money.
   * A cross-ROW invariant on the contact, so it cannot be a row CHECK; enforced in grantService and
   * on every path including the CLI (FR-033). Names the conflicting role held.
   */
  exclusiveRoleConflict: (held: string) =>
    new ApiError(
      "EXCLUSIVE_ROLE_CONFLICT",
      422,
      `President, VP and Treasurer are mutually exclusive; this contact already holds ${held}.`,
    ),
  /** R3: only a volunteer may hold grants (the retired roles_require_volunteer, re-expressed here). */
  grantRequiresVolunteer: () =>
    new ApiError(
      "GRANT_REQUIRES_VOLUNTEER",
      422,
      "Roles may only be granted to a volunteer; designate the contact first.",
    ),
  /** FR-030a: Super-user is grantable from no screen, by nobody — only the operator CLI. */
  roleNotUiGrantable: (role: string) =>
    new ApiError(
      "ROLE_NOT_UI_GRANTABLE",
      422,
      `${role} may only be granted from the operator CLI.`,
    ),
  grantNotFound: () => new ApiError("GRANT_NOT_FOUND", 404, "Grant not found."),
  seriesNotFound: () => new ApiError("SERIES_NOT_FOUND", 404, "Series not found."),
  eventGroupNotFound: () => new ApiError("EVENT_GROUP_NOT_FOUND", 404, "Event group not found."),
  eventNotFound: () => new ApiError("EVENT_NOT_FOUND", 404, "Event not found."),
  // Feature 019 US4 (FR-019): the refusal NAMES the blocker (gate sales / money / check / payment) so the
  // organizer knows what to clear. `detail` carries the specific blocker.
  eventHasHistory: (blocker: string) =>
    new ApiError(
      "EVENT_HAS_HISTORY",
      409,
      `This event has ${blocker} — cancel it instead of deleting.`,
      blocker,
    ),
  // Feature 019 US4 (FR-018a): attendance no longer hard-blocks; it must be confirmed. The count travels
  // in `detail` so the UI can show it before the destructive retry with confirmDiscardAttendance.
  eventHasAttendance: (attendeeCount: number) =>
    new ApiError(
      "EVENT_HAS_ATTENDANCE",
      409,
      `This event has ${attendeeCount} checked-in attendee(s). Confirm to delete and discard them.`,
      String(attendeeCount),
    ),
  recurrenceTooLarge: (cap: number) =>
    new ApiError(
      "RECURRENCE_TOO_LARGE",
      422,
      `That range would generate more than ${cap} events; narrow it or split into runs.`,
    ),
  doorRecordExists: () =>
    new ApiError("DOOR_RECORD_EXISTS", 409, "This event already has a door record."),
  doorRecordNotFound: () => new ApiError("DOOR_RECORD_NOT_FOUND", 404, "Door record not found."),
  attendanceNotFound: () =>
    new ApiError("ATTENDANCE_NOT_FOUND", 404, "Attendance record not found."),
  alreadyCheckedIn: () =>
    new ApiError("ALREADY_CHECKED_IN", 409, "This contact is already recorded for this event."),
  cashPayoutReasonRequired: () =>
    new ApiError("CASH_PAYOUT_REASON_REQUIRED", 422, "A reason is required for cash paid out."),
  performerNotFound: () => new ApiError("PERFORMER_NOT_FOUND", 404, "Performer not found."),
  bookingNotFound: () => new ApiError("BOOKING_NOT_FOUND", 404, "Booking not found."),
  performerPaymentNotFound: () =>
    new ApiError("PERFORMER_PAYMENT_NOT_FOUND", 404, "Performer payment not found."),
  // Feature 019 US2: settlement is per event; a payment may not aggregate bookings across events.
  bookingEventMismatch: () =>
    new ApiError(
      "BOOKING_EVENT_MISMATCH",
      422,
      "All bookings on a payment must belong to the payment's event.",
    ),
  soundTechNotAllowed: () =>
    new ApiError(
      "SOUND_TECH_NOT_ALLOWED",
      422,
      "Sound Tech is not allowed for this event's series.",
    ),
  mailingListNotFound: () => new ApiError("MAILING_LIST_NOT_FOUND", 404, "Unknown mailing list."),
  bandNotFound: () => new ApiError("BAND_NOT_FOUND", 404, "Band not found."),
  venueNotFound: () => new ApiError("VENUE_NOT_FOUND", 404, "Venue not found."),
};
