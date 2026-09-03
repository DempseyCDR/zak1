import { and, eq, inArray, ne, sql } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import { contactEmails, contacts } from "@/server/db/schema";
import type { ContactEmailRow, ContactRow, EmailConsentTopic } from "@/server/db/schema";
import { errors } from "@/server/lib/apiError";
import { recordAudit, writeAudit } from "@/server/lib/audit";
import { uniqueSet } from "./normalize";
import type { EmailAddInput, EmailPatchInput } from "@/server/validation/contacts";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type DbOrTx = Db | Tx;

const UNIQUE_VIOLATION = "23505";

/**
 * "Do Not Contact" is exclusive: when present it overrides all other topics
 * (data-model consent rules). Normalize on write so stored data is unambiguous.
 */
export function effectiveConsentTopics(topics: readonly EmailConsentTopic[]): EmailConsentTopic[] {
  if (topics.includes("do_not_contact")) return ["do_not_contact"];
  return uniqueSet(topics);
}

function isLoginAllowed(contact: Pick<ContactRow, "isVolunteer">): boolean {
  return contact.isVolunteer;
}

/** Insert an email within an existing contact context (shared by create + add). */
export async function addEmailInTx(
  tx: DbOrTx,
  contact: Pick<ContactRow, "id" | "isVolunteer">,
  input: EmailAddInput,
): Promise<ContactEmailRow> {
  if (input.isLogin && !isLoginAllowed(contact)) throw errors.loginNotPermitted();

  const purposes = uniqueSet(input.purposes);
  const consentTopics = effectiveConsentTopics(input.consentTopics);

  try {
    const [row] = await tx
      .insert(contactEmails)
      .values({
        contactId: contact.id,
        email: input.address,
        purposes,
        consentTopics,
        status: input.status,
        isLogin: input.isLogin,
      })
      .returning();
    if (!row) throw new Error("email insert failed");
    writeAudit({ kind: "email.created", actor: null, details: { emailId: row.id } });
    return row;
  } catch (err) {
    if (typeof err === "object" && err && (err as { code?: string }).code === UNIQUE_VIOLATION) {
      throw errors.emailDuplicate();
    }
    throw err;
  }
}

/**
 * Feature 066 (M-R15.3 / F1): a PRE-WRITE lookup — is this address already active/transition on ANOTHER
 * contact? Used by the standalone `addEmail`/`patchEmail` so a collision becomes a dedup signal without
 * relying on a post-violation query (which would fail inside `createContact`'s aborted transaction).
 */
async function emailActiveElsewhere(
  db: Db,
  address: string,
  excludeContactId: string,
): Promise<{ contactId: string; displayName: string } | null> {
  const [hit] = await db
    .select({ contactId: contactEmails.contactId, displayName: contacts.displayName })
    .from(contactEmails)
    .innerJoin(contacts, eq(contacts.id, contactEmails.contactId))
    .where(
      and(
        sql`lower(trim(${contactEmails.email}::text)) = lower(trim(${address}))`,
        inArray(contactEmails.status, ["active", "transition"]),
        ne(contactEmails.contactId, excludeContactId),
      ),
    )
    .limit(1);
  return hit ?? null;
}

export async function addEmail(
  db: Db,
  contactId: string,
  input: EmailAddInput,
): Promise<ContactEmailRow> {
  const contact = await db.query.contacts.findFirst({ where: eq(contacts.id, contactId) });
  if (!contact) throw errors.contactNotFound();
  const other = await emailActiveElsewhere(db, input.address, contactId);
  if (other) throw errors.emailActiveElsewhere(other); // feature 066: dedup signal, not a bare duplicate
  return addEmailInTx(db, contact, input);
}

export async function patchEmail(
  db: Db,
  contactId: string,
  emailId: string,
  input: EmailPatchInput,
): Promise<ContactEmailRow> {
  const existing = await db.query.contactEmails.findFirst({
    where: eq(contactEmails.id, emailId),
  });
  if (!existing || existing.contactId !== contactId) throw errors.emailNotFound();

  if (input.isLogin === true) {
    const contact = await db.query.contacts.findFirst({ where: eq(contacts.id, contactId) });
    if (!contact || !isLoginAllowed(contact)) throw errors.loginNotPermitted();
  }

  // Feature 066 (M-R15.3): changing the address into one active on another contact → dedup signal.
  if (input.email !== undefined) {
    const other = await emailActiveElsewhere(db, input.email, contactId);
    if (other) throw errors.emailActiveElsewhere(other);
  }

  try {
    const [row] = await db
      .update(contactEmails)
      .set({
        ...(input.email !== undefined ? { email: input.email } : {}), // feature 066 (M-R13)
        ...(input.purposes !== undefined ? { purposes: uniqueSet(input.purposes) } : {}),
        ...(input.consentTopics !== undefined
          ? { consentTopics: effectiveConsentTopics(input.consentTopics) }
          : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.isLogin !== undefined ? { isLogin: input.isLogin } : {}),
        updatedAt: new Date(),
      })
      .where(eq(contactEmails.id, emailId))
      .returning();
    if (!row) throw errors.emailNotFound();
    return row;
  } catch (err) {
    if (typeof err === "object" && err && (err as { code?: string }).code === UNIQUE_VIOLATION) {
      throw errors.emailDuplicate();
    }
    throw err;
  }
}

/**
 * Feature 066 (M-R17): permanently delete an email row (super-user hard delete). The row's history and
 * telemetry are erased — audited. Soft "remove" is a status=inactive patch, not this.
 */
export async function deleteEmail(
  db: Db,
  contactId: string,
  emailId: string,
  actor: string | null = null,
): Promise<void> {
  const existing = await db.query.contactEmails.findFirst({
    where: eq(contactEmails.id, emailId),
  });
  if (!existing || existing.contactId !== contactId) throw errors.emailNotFound();
  await db.delete(contactEmails).where(eq(contactEmails.id, emailId));
  await recordAudit(db, {
    kind: "email.deleted",
    actorContactId: actor,
    details: { contactId, emailId },
  });
}
