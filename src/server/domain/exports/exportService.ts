import { and, eq, sql } from "drizzle-orm";
import type { DbOrTx } from "@/server/db/client";
import { contactEmails, contacts, memberships, performers } from "@/server/db/schema";
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
