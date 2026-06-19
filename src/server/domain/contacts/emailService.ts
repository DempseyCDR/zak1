import { eq } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import { contactEmails, contacts } from "@/server/db/schema";
import type { ContactEmailRow, ContactRow, EmailConsentTopic } from "@/server/db/schema";
import { errors } from "@/server/lib/apiError";
import { writeAudit } from "@/server/lib/audit";
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

export async function addEmail(
  db: Db,
  contactId: string,
  input: EmailAddInput,
): Promise<ContactEmailRow> {
  const contact = await db.query.contacts.findFirst({ where: eq(contacts.id, contactId) });
  if (!contact) throw errors.contactNotFound();
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

  try {
    const [row] = await db
      .update(contactEmails)
      .set({
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
