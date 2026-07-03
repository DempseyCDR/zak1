import { db } from "./db";
import { createEvent } from "@/server/domain/events/eventService";
import { createPerformer } from "@/server/domain/performers/performerService";
import { createDoorRecord, putGateSales } from "@/server/domain/door/doorRecordService";
import { normalizeName } from "@/server/domain/contacts/normalize";
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

/** Create a contact with a single email, for export-qualification tests. */
export async function makeContactWithEmail(opts: {
  displayName?: string;
  email: string;
  consentTopics?: EmailConsentTopic[];
  emailStatus?: EmailStatus;
  listMember?: boolean;
  membershipStatus?: MembershipStatus;
}): Promise<{ contactId: string; emailId: string }> {
  const displayName = opts.displayName ?? "Test Contact";
  const [contact] = await db
    .insert(contacts)
    .values({
      displayName,
      nameNormalized: normalizeName(displayName),
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
