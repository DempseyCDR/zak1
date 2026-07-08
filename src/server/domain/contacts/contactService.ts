import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import { contactEmails, contacts } from "@/server/db/schema";
import type { ContactRow } from "@/server/db/schema";
import { errors } from "@/server/lib/apiError";
import { writeAudit } from "@/server/lib/audit";
import { deriveContactNames, normalizeName, uniqueSet } from "./normalize";
import { addEmailInTx } from "./emailService";
import type { ContactCreateInput, ContactPatchInput } from "@/server/validation/contacts";

export type ContactWithEmails = ContactRow & {
  emails: (typeof contactEmails.$inferSelect)[];
};

export async function createContact(
  db: Db,
  input: ContactCreateInput,
  actor: string | null = null,
): Promise<ContactWithEmails> {
  return db.transaction(async (tx) => {
    const derived = deriveContactNames({
      firstName: input.firstName,
      lastName: input.lastName ?? null,
      displayNameOverride: input.displayNameOverride ?? null,
    });
    const [contact] = await tx
      .insert(contacts)
      .values({
        firstName: input.firstName,
        lastName: input.lastName ?? null,
        displayNameOverride: input.displayNameOverride ?? null,
        pronouns: input.pronouns ?? null,
        displayName: derived.displayName,
        nameNormalized: derived.nameNormalized,
        dedupNormalized: derived.dedupNormalized,
        phone: input.phone ?? null,
        // No email and no phone: allow the contact but flag it for admin follow-up.
        needsReview: !input.email && !input.phone,
      })
      .returning();
    if (!contact) throw new Error("contact insert failed");

    const emails = input.email
      ? [
          await addEmailInTx(tx, contact, {
            address: input.email.address,
            purposes: input.email.purposes,
            consentTopics: input.email.consentTopics,
            status: input.email.status,
            isLogin: input.email.isLogin,
          }),
        ]
      : [];

    writeAudit({ kind: "contact.created", actor, details: { contactId: contact.id } });
    return { ...contact, emails };
  });
}

export async function getContact(db: Db, id: string): Promise<ContactWithEmails> {
  const contact = await db.query.contacts.findFirst({ where: eq(contacts.id, id) });
  if (!contact) throw errors.contactNotFound();
  const emails = await db
    .select()
    .from(contactEmails)
    .where(eq(contactEmails.contactId, id));
  return { ...contact, emails };
}

export async function patchContact(
  db: Db,
  id: string,
  input: ContactPatchInput,
): Promise<ContactRow> {
  const existing = await db.query.contacts.findFirst({ where: eq(contacts.id, id) });
  if (!existing) throw errors.contactNotFound();

  const isVolunteer = input.isVolunteer ?? existing.isVolunteer;
  const roles =
    input.volunteerRoles !== undefined ? uniqueSet(input.volunteerRoles) : existing.volunteerRoles;

  if (roles.length > 0 && !isVolunteer) throw errors.rolesRequireVolunteer();

  // Recompute the maintained name values when any name field changes (an override edit, or first/last).
  const nameChanged =
    input.firstName !== undefined ||
    input.lastName !== undefined ||
    input.displayNameOverride !== undefined;
  const derived = nameChanged
    ? deriveContactNames({
        firstName: input.firstName ?? existing.firstName,
        lastName: input.lastName !== undefined ? input.lastName : existing.lastName,
        displayNameOverride:
          input.displayNameOverride !== undefined
            ? input.displayNameOverride
            : existing.displayNameOverride,
      })
    : null;

  const [updated] = await db
    .update(contacts)
    .set({
      ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
      ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
      ...(input.displayNameOverride !== undefined
        ? { displayNameOverride: input.displayNameOverride }
        : {}),
      ...(input.pronouns !== undefined ? { pronouns: input.pronouns } : {}),
      ...(derived
        ? {
            displayName: derived.displayName,
            nameNormalized: derived.nameNormalized,
            dedupNormalized: derived.dedupNormalized,
          }
        : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      isVolunteer,
      volunteerRoles: roles,
      updatedAt: new Date(),
    })
    .where(eq(contacts.id, id))
    .returning();
  if (!updated) throw errors.contactNotFound();
  return updated;
}

export type ContactSummary = Pick<
  ContactRow,
  "id" | "displayName" | "membershipStatus" | "listMember" | "pronouns"
>;

/**
 * Fuzzy name search using pg_trgm similarity, restricted to non-merged contacts.
 * Returns ranked summaries. When q is empty, returns recent contacts.
 */
export async function searchContacts(
  db: Db,
  q: string,
  limit = 20,
  opts: { orderBy?: "recent" | "name" } = {},
): Promise<ContactSummary[]> {
  const cols = {
    id: contacts.id,
    displayName: contacts.displayName,
    membershipStatus: contacts.membershipStatus,
    listMember: contacts.listMember,
    pronouns: contacts.pronouns,
  };

  if (!q.trim()) {
    // Browse the roster: alphabetical by last then first name for the door (FR-007), else most recent.
    const order =
      opts.orderBy === "name"
        ? [sql`${contacts.lastName} ASC NULLS LAST`, contacts.firstName]
        : [desc(contacts.createdAt)];
    return db
      .select(cols)
      .from(contacts)
      .where(isNull(contacts.mergedIntoId))
      .orderBy(...order)
      .limit(limit);
  }

  const needle = normalizeName(q);
  return db
    .select(cols)
    .from(contacts)
    .where(
      and(
        isNull(contacts.mergedIntoId),
        sql`${contacts.nameNormalized} % ${needle}`,
      ),
    )
    .orderBy(sql`similarity(${contacts.nameNormalized}, ${needle}) DESC`)
    .limit(limit);
}
