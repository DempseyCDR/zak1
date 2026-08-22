import type { EmailConsentTopic, MembershipLevel } from "@/server/db/schema";

/**
 * Feature 044 — in-memory representation of a contact-load run.
 *
 * The parsers (parseIcontact / parseMemberSheet / parsePayerSheet) produce the `*Row` shapes; buildRoster
 * and buildMemberships fold them into the `Planned*` shapes; the executor turns those into rows and
 * reports `LoadCounts`. Nothing here is persisted — it is the plan the executor applies (and that dry-run
 * reports without committing).
 */

/** iContact per-list subscription flags (value `1` = subscribed; blank or `-1` = not — research R3). */
export type IcontactListFlags = {
  contra: boolean;
  english: boolean;
  openband: boolean;
  specialevents: boolean;
  janeAustenBall: boolean;
};

export type IcontactRow = {
  email: string; // lowercased; the join key to the Member sheet
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  providerSetDate: Date | null;
  providerLastOpen: Date | null;
  providerLastClick: Date | null;
  flags: IcontactListFlags;
};

export type MemberRow = {
  firstName: string; // may be "" — buildRoster derives a placeholder + needsReview
  lastName: string | null;
  buttonName: string | null;
  pronouns: string | null;
  volunteer: boolean;
  payerKey: string | null; // Member sheet "Payer" — links to a PayerInput.key
  email: string | null; // lowercased, or null
  phone: string | null;
};

export type PayerInput = {
  key: string; // Payer sheet "ID"
  payerName: string;
  expires: string | null; // 'YYYY-MM-DD', or null when blank/unparseable (no membership then)
  level: MembershipLevel;
};

export type PlannedEmail = {
  email: string;
  consentTopics: EmailConsentTopic[];
  providerSetDate: Date | null;
  providerLastOpen: Date | null;
  providerLastClick: Date | null;
};

export type PlannedContact = {
  dedupKey: string;
  firstName: string;
  lastName: string | null;
  displayNameOverride: string | null;
  pronouns: string | null;
  phone: string | null;
  isVolunteer: boolean;
  needsReview: boolean;
  emails: PlannedEmail[];
  /** From the Member sheet — links this contact to a payer/membership. */
  payerKey: string | null;
};

export type PlannedPayer = {
  key: string;
  name: string;
  /** dedup key of the paying member (FR-020), or null when no/multiple match. */
  contactDedupKey: string | null;
};

export type PlannedMembership = {
  contactDedupKey: string;
  payerKey: string;
  expiry: string; // 'YYYY-MM-DD'
  level: MembershipLevel;
};

export const MEMBERSHIP_LEVELS: MembershipLevel[] = [
  "individual",
  "family",
  "supporter",
  "student",
];

export type LoadCounts = {
  retained: number;
  removed: number;
  contactsCreated: number;
  contactsUpdated: number;
  emailsCreated: number;
  membershipsCreated: number;
  membershipsByLevel: Record<MembershipLevel, number>;
  volunteersSet: number;
  needsReview: number;
  performerAuto: number;
  performerAmbiguous: number;
  performerUnmatched: number;
};

export type PerformerResolution = {
  auto: Array<{ performerId: string; contactId: string }>;
  ambiguous: Array<{ performerId: string; displayName: string; candidateContactIds: string[] }>;
  unmatched: Array<{ performerId: string; displayName: string }>;
};

export function emptyCounts(): LoadCounts {
  return {
    retained: 0,
    removed: 0,
    contactsCreated: 0,
    contactsUpdated: 0,
    emailsCreated: 0,
    membershipsCreated: 0,
    membershipsByLevel: { individual: 0, family: 0, supporter: 0, student: 0 },
    volunteersSet: 0,
    needsReview: 0,
    performerAuto: 0,
    performerAmbiguous: 0,
    performerUnmatched: 0,
  };
}
