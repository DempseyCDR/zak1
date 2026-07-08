import { db } from "./db";
import { createEvent } from "@/server/domain/events/eventService";
import { createPerformer } from "@/server/domain/performers/performerService";
import { createDoorRecord, putGateSales } from "@/server/domain/door/doorRecordService";
import { deriveContactNames } from "@/server/domain/contacts/normalize";
import { contactEmails, contacts } from "@/server/db/schema";
import type { EventRow, PerformerRow } from "@/server/db/schema";
import type { GateCategory, PaymentMethod } from "@/server/db/schema";
import type { EmailConsentTopic, EmailStatus, MembershipStatus } from "@/server/db/schema";

export async function makeEvent(opts?: {
  seriesKey?: string;
  eventDate?: string;
  chargesAdmission?: boolean;
  groupId?: string;
}): Promise<EventRow> {
  return createEvent(db, {
    seriesKey: opts?.seriesKey ?? "tnc",
    eventDate: opts?.eventDate ?? "2026-06-18",
    chargesAdmission: opts?.chargesAdmission ?? true,
    ...(opts?.groupId ? { groupId: opts.groupId } : {}),
  });
}

export async function makePerformer(displayName = "Test Performer"): Promise<PerformerRow> {
  return createPerformer(db, { displayName });
}

/**
 * Insert-values for a contact created directly in a test (bypassing the API): the given name becomes
 * first_name (last blank) and fills the maintained display/normalized/dedup columns — so display,
 * search, and dedup behave exactly as they did before feature 012's structured names.
 */
export function contactRow(displayName: string): {
  firstName: string;
  displayName: string;
  nameNormalized: string;
  dedupNormalized: string;
} {
  return { firstName: displayName, ...deriveContactNames({ firstName: displayName }) };
}

/** Create a contact with a single email, for export-qualification tests. */
export async function makeContactWithEmail(opts: {
  /** Backward-compatible: used as firstName when firstName is not given. */
  displayName?: string;
  firstName?: string;
  lastName?: string;
  displayNameOverride?: string;
  email: string;
  consentTopics?: EmailConsentTopic[];
  emailStatus?: EmailStatus;
  listMember?: boolean;
  membershipStatus?: MembershipStatus;
}): Promise<{ contactId: string; emailId: string }> {
  const firstName = opts.firstName ?? opts.displayName ?? "Test Contact";
  const lastName = opts.lastName ?? null;
  const names = deriveContactNames({
    firstName,
    lastName,
    displayNameOverride: opts.displayNameOverride ?? null,
  });
  const [contact] = await db
    .insert(contacts)
    .values({
      firstName,
      lastName,
      displayNameOverride: opts.displayNameOverride ?? null,
      displayName: names.displayName,
      nameNormalized: names.nameNormalized,
      dedupNormalized: names.dedupNormalized,
      listMember: opts.listMember ?? false,
      membershipStatus: opts.membershipStatus ?? "never",
    })
    .returning();
  if (!contact) throw new Error("contact insert failed");
  const [email] = await db
    .insert(contactEmails)
    .values({
      contactId: contact.id,
      email: opts.email,
      consentTopics: opts.consentTopics ?? ["contact_tracing"],
      status: opts.emailStatus ?? "active",
    })
    .returning();
  if (!email) throw new Error("email insert failed");
  return { contactId: contact.id, emailId: email.id };
}

/** Create a door record for an event and optionally set gate sales (dollar amounts). */
export async function makeDoorRecord(
  eventId: string,
  sales: {
    category: Exclude<GateCategory, "admission">;
    paymentMethod: PaymentMethod;
    amount: number;
    contactId?: string;
  }[] = [],
): Promise<string> {
  const dr = await createDoorRecord(db, eventId, "test");
  if (sales.length) await putGateSales(db, dr.id, { sales });
  return dr.id;
}
