import { and, desc, eq, sql } from "drizzle-orm";
import type { DbOrTx } from "@/server/db/client";
import { contactEmails, contacts, eventGroups, events, memberships, performers } from "@/server/db/schema";
import { getMailingListDef } from "./mailingLists";
import { throughYear } from "./throughYear";
import type { ListId } from "@/server/validation/exports";

/** Split on the last whitespace boundary: remainder = first name, final token = last name (FR-011). */
export function splitDisplayName(displayName: string): { firstName: string; lastName: string } {
  const trimmed = displayName.trim();
  const lastSpace = trimmed.lastIndexOf(" ");
  if (lastSpace === -1) return { firstName: "", lastName: trimmed };
  return {
    firstName: trimmed.slice(0, lastSpace).trim(),
    lastName: trimmed.slice(lastSpace + 1).trim(),
  };
}

function baseRow(email: string, displayName: string): Record<string, string> {
  const { firstName, lastName } = splitDisplayName(displayName);
  return { email, first_name: firstName, last_name: lastName };
}

/** Rows for one of the 7 fixed mailing lists (topic or derived), FR-002/FR-002a/FR-003/FR-011. */
export async function buildListRows(db: DbOrTx, listId: ListId): Promise<Record<string, string>[]> {
  const def = getMailingListDef(listId);

  if (def.kind === "topic") {
    const rows = await db
      .select({ email: contactEmails.email, displayName: contacts.displayName })
      .from(contactEmails)
      .innerJoin(contacts, eq(contacts.id, contactEmails.contactId))
      .where(
        and(
          eq(contactEmails.status, "active"),
          sql`${def.consentTopic}::email_consent_topic = ANY(${contactEmails.consentTopics})`,
        ),
      );
    return rows.map((r) => baseRow(r.email, r.displayName));
  }

  if (listId === "member") {
    const rows = await db
      .select({
        email: contactEmails.email,
        displayName: contacts.displayName,
        membershipStatus: contacts.membershipStatus,
        maxExpiry: sql<string | null>`(SELECT MAX(${memberships.expiryDate}) FROM ${memberships} WHERE ${memberships.contactId} = ${contacts.id})`,
      })
      .from(contactEmails)
      .innerJoin(contacts, eq(contacts.id, contactEmails.contactId))
      .where(
        and(
          eq(contactEmails.status, "active"),
          eq(contacts.listMember, true),
          sql`NOT ('do_not_contact'::email_consent_topic = ANY(${contactEmails.consentTopics}))`,
        ),
      );
    return rows.map((r) => {
      const year = throughYear(r.maxExpiry);
      return {
        ...baseRow(r.email, r.displayName),
        membership_status: r.membershipStatus,
        membership_through_year: year === null ? "" : String(year),
      };
    });
  }

  // performer — selectDistinct guards against a contact linked to more than one performers row
  const rows = await db
    .selectDistinct({ email: contactEmails.email, displayName: contacts.displayName })
    .from(contactEmails)
    .innerJoin(contacts, eq(contacts.id, contactEmails.contactId))
    .innerJoin(performers, eq(performers.contactId, contacts.id))
    .where(
      and(
        eq(contactEmails.status, "active"),
        sql`NOT ('do_not_contact'::email_consent_topic = ANY(${contactEmails.consentTopics}))`,
      ),
    );
  return rows.map((r) => baseRow(r.email, r.displayName));
}

/** Year of the most recent Jane Austen Ball event, for the admin-page label only (Decision 6). */
export async function getMostRecentJabYear(db: DbOrTx): Promise<number | null> {
  const [row] = await db
    .select({ eventDate: events.eventDate })
    .from(events)
    .innerJoin(eventGroups, eq(eventGroups.id, events.groupId))
    .where(eq(eventGroups.kind, "jane_austen_ball"))
    .orderBy(desc(events.eventDate))
    .limit(1);
  if (!row) return null;
  return Number(row.eventDate.slice(0, 4));
}
