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

export type EmailPurpose = (typeof emailPurposeEnum.enumValues)[number];
export type EmailStatus = (typeof emailStatusEnum.enumValues)[number];
export type MembershipStatus = (typeof membershipStatusEnum.enumValues)[number];
export type VolunteerRole = (typeof volunteerRoleEnum.enumValues)[number];
export type EmailConsentTopic = (typeof emailConsentTopicEnum.enumValues)[number];
