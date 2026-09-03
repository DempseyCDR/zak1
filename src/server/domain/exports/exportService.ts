import { sql } from "drizzle-orm";
import type { DbOrTx } from "@/server/db/client";
import { getMailingListDef } from "./mailingLists";
import { resolvedRecipients } from "./recipients";
import { throughYear } from "./throughYear";
import type { ListId } from "@/server/validation/exports";

// First/Last come straight from the structured contact fields (feature 012); blank last → blank cell.
function baseRow(
  email: string,
  firstName: string,
  lastName: string | null,
): Record<string, string> {
  return { email, first_name: firstName, last_name: lastName ?? "" };
}

type RecipientRow = {
  address: string;
  owner_first_name: string;
  owner_last_name: string | null;
};

/**
 * Rows for one of the 6 fixed mailing lists (topic or derived), FR-002/FR-002a/FR-003/FR-011.
 *
 * Feature 067: every list resolves through `resolved_recipients` — a contact with no address of its own
 * is reached at the household address it references. Output is `DISTINCT ON (address)` so a shared
 * household appears exactly ONCE, and each row carries the OWNER'S name, leaving the provider CSV
 * columns exactly as they were (FR-010).
 *
 * Qualification and consent come from different places, which is the whole of FR-010a/FR-010b:
 *   • topic lists qualify on the OWNER'S consent (`consent_topics` lives on the email row), so a
 *     referrer — who holds no consent of her own — can never pull an address onto one;
 *   • `member` / `performer` qualify on the CONTACT row, so a referrer's own membership or performer
 *     link does pull the household address in, even when the owner does not qualify;
 *   • the owner's `do_not_contact` suppresses the address absolutely, beating any qualification.
 */
export async function buildListRows(db: DbOrTx, listId: ListId): Promise<Record<string, string>[]> {
  const def = getMailingListDef(listId);

  if (def.kind === "topic") {
    // The consent that qualifies is the owner's, carried on the resolved email row.
    const rows = await db.execute<RecipientRow>(sql`
      WITH ${resolvedRecipients}
      SELECT DISTINCT ON (r.address) r.address, r.owner_first_name, r.owner_last_name
        FROM resolved_recipients r
       WHERE ${def.consentTopic}::email_consent_topic = ANY(r.consent_topics)
       ORDER BY r.address, (r.contact_id = r.owner_contact_id) DESC
    `);
    return [...rows].map((r) => baseRow(r.address, r.owner_first_name, r.owner_last_name));
  }

  if (listId === "member") {
    const rows = await db.execute<
      RecipientRow & { membership_status: string; max_expiry: string | null }
    >(sql`
      WITH ${resolvedRecipients}
      SELECT DISTINCT ON (r.address)
             r.address, r.owner_first_name, r.owner_last_name,
             c.membership_status,
             (SELECT MAX(m.expiry_date) FROM memberships m WHERE m.contact_id = c.id) AS max_expiry
        FROM resolved_recipients r
        JOIN contacts c ON c.id = r.contact_id
       WHERE c.list_member = TRUE
         AND NOT ('do_not_contact'::email_consent_topic = ANY(r.consent_topics))
       -- Prefer the owner's own qualifying row so an unshared export is byte-identical to before.
       ORDER BY r.address, (r.contact_id = r.owner_contact_id) DESC, c.id
    `);
    return [...rows].map((r) => {
      const year = throughYear(r.max_expiry);
      return {
        ...baseRow(r.address, r.owner_first_name, r.owner_last_name),
        membership_status: r.membership_status,
        membership_through_year: year === null ? "" : String(year),
      };
    });
  }

  // performer — DISTINCT ON also guards a contact linked to more than one performers row.
  const rows = await db.execute<RecipientRow>(sql`
    WITH ${resolvedRecipients}
    SELECT DISTINCT ON (r.address) r.address, r.owner_first_name, r.owner_last_name
      FROM resolved_recipients r
      JOIN contacts c ON c.id = r.contact_id
      JOIN performers p ON p.contact_id = c.id
     WHERE NOT ('do_not_contact'::email_consent_topic = ANY(r.consent_topics))
     ORDER BY r.address, (r.contact_id = r.owner_contact_id) DESC
  `);
  return [...rows].map((r) => baseRow(r.address, r.owner_first_name, r.owner_last_name));
}
