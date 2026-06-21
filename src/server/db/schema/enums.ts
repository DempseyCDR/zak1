import { pgEnum } from "drizzle-orm/pg-core";

export const emailPurposeEnum = pgEnum("email_purpose", [
  "personal",
  "booking",
  "public_profile",
  "other",
]);

export const emailStatusEnum = pgEnum("email_status", ["active", "transition", "inactive"]);

export const membershipStatusEnum = pgEnum("membership_status", [
  "current",
  "lapsed",
  "long_lapsed",
  "never",
]);

export const volunteerRoleEnum = pgEnum("volunteer_role", ["door_attendant", "administrator"]);

export const emailConsentTopicEnum = pgEnum("email_consent_topic", [
  "contra",
  "english",
  "openband",
  "special_events",
  "jane_austen_ball",
  "contact_tracing",
  "do_not_contact",
]);

export const gateCategoryEnum = pgEnum("gate_category", [
  "today_admission",
  "merchandise",
  "donation",
  "future_event",
  "membership",
  "gift_card",
  "misc_sales",
]);

export const paymentMethodEnum = pgEnum("payment_method", ["cash", "card"]);

export const eventGroupKindEnum = pgEnum("event_group_kind", [
  "double_dance",
  "weekend",
  "jane_austen_ball",
  "other",
]);

export const performerTypeEnum = pgEnum("performer_type", [
  "caller",
  "lead_musician",
  "open_band_musician",
  "sound_tech",
  "instructor",
]);

export const rateKindEnum = pgEnum("rate_kind", ["caller", "sound_tech"]);

export type PerformerType = (typeof performerTypeEnum.enumValues)[number];
export type RateKind = (typeof rateKindEnum.enumValues)[number];

export type GateCategory = (typeof gateCategoryEnum.enumValues)[number];
export type PaymentMethod = (typeof paymentMethodEnum.enumValues)[number];
export type EventGroupKind = (typeof eventGroupKindEnum.enumValues)[number];

export type EmailPurpose = (typeof emailPurposeEnum.enumValues)[number];
export type EmailStatus = (typeof emailStatusEnum.enumValues)[number];
export type MembershipStatus = (typeof membershipStatusEnum.enumValues)[number];
export type VolunteerRole = (typeof volunteerRoleEnum.enumValues)[number];
export type EmailConsentTopic = (typeof emailConsentTopicEnum.enumValues)[number];
