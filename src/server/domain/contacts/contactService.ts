import { and, count, desc, eq, isNull, sql } from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";
import type { Db } from "@/server/db/client";
import {
  attendance,
  contactEmails,
  contacts,
  gateSales,
  memberships,
  membershipCaptures,
  officers,
  performers,
  roleGrants,
  staffIdentities,
  venues,
} from "@/server/db/schema";
import type { ContactRow } from "@/server/db/schema";
import { errors } from "@/server/lib/apiError";
import { recordAudit, writeAudit } from "@/server/lib/audit";
import { deriveContactNames, normalizeName } from "./normalize";
import { normalizePhone } from "./phone";
import { addEmailInTx } from "./emailService";
import { clearReferencesToOwner } from "./referenceService";
import type { ContactCreateInput, ContactPatchInput } from "@/server/validation/contacts";

/** Feature 067 (FR-009/FR-016): the shared address this contact rides, if any. */
export type MessageRecipientView = {
  emailId: string;
  /** Contact PII — nulled for an actor without `contact.pii.read` (FR-016). */
  address: string | null;
  ownerContactId: string;
  ownerDisplayName: string;
};

export type ContactWithEmails = ContactRow & {
  emails: (typeof contactEmails.$inferSelect)[];
  /** Feature 067: set only when this contact rides someone else's address. */
  messageRecipient?: MessageRecipientView | null;
  /** Feature 067 (FR-010c): contacts that ride THIS contact's address. Names/ids only, no PII. */
  sharedWith?: { contactId: string; displayName: string }[];
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
        phone: input.phone ? normalizePhone(input.phone) : null, // feature 032: canonical E.164
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
  const emails = await db.select().from(contactEmails).where(eq(contactEmails.contactId, id));

  // Feature 067: the household view. `messageRecipient` is where THIS contact is reached when it owns
  // no address; `sharedWith` is who rides this contact's address (FR-010c) — the app is the only place
  // the roster is visible, since the export file carries only the owner's name.
  const [owner] = contact.messageRecipientEmailId
    ? await db
        .select({
          emailId: contactEmails.id,
          address: contactEmails.email,
          ownerContactId: contacts.id,
          ownerDisplayName: contacts.displayName,
        })
        .from(contactEmails)
        .innerJoin(contacts, eq(contacts.id, contactEmails.contactId))
        .where(eq(contactEmails.id, contact.messageRecipientEmailId))
        .limit(1)
    : [];

  const sharedWith = emails.length
    ? await db
        .select({ contactId: contacts.id, displayName: contacts.displayName })
        .from(contacts)
        .innerJoin(contactEmails, eq(contactEmails.id, contacts.messageRecipientEmailId))
        .where(eq(contactEmails.contactId, id))
    : [];

  return { ...contact, emails, messageRecipient: owner ?? null, sharedWith };
}

export async function patchContact(
  db: Db,
  id: string,
  input: ContactPatchInput,
): Promise<ContactRow> {
  const existing = await db.query.contacts.findFirst({ where: eq(contacts.id, id) });
  if (!existing) throw errors.contactNotFound();

  // Roles are no longer a field on this row (feature 016): they are `role_grants`, because scope
  // cannot live in an array. Granting and revoking is the President/VP's job via the access screen,
  // not a side effect of editing a contact — so this endpoint no longer touches authority at all.
  const isVolunteer = input.isVolunteer ?? existing.isVolunteer;

  // Feature 064 (FR-012): `needs_review` auto-clears once the record has the required data — a phone or
  // an active email (the condition whose absence set the flag). Only ever clears; never re-flags.
  const resultingPhone =
    input.phone !== undefined ? (input.phone ? normalizePhone(input.phone) : null) : existing.phone;
  const emailRows = await db.execute<{ n: number }>(
    sql`SELECT COUNT(*)::int AS n FROM contact_emails
        WHERE contact_id = ${id} AND status IN ('active', 'transition')`,
  );
  const hasContactInfo = !!resultingPhone || ([...emailRows][0]?.n ?? 0) > 0;
  const needsReview = hasContactInfo ? false : existing.needsReview;

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
      ...(input.phone !== undefined
        ? { phone: input.phone ? normalizePhone(input.phone) : input.phone } // feature 032
        : {}),
      isVolunteer,
      needsReview,
      updatedAt: new Date(),
    })
    .where(eq(contacts.id, id))
    .returning();
  if (!updated) throw errors.contactNotFound();
  return updated;
}

export type ContactSummary = Pick<
  ContactRow,
  "id" | "displayName" | "membershipStatus" | "listMember" | "pronouns" | "archivedAt"
>;

export type ContactSearchResult = { items: ContactSummary[]; truncated: boolean };

/**
 * Feature 065 (M-R10): "active contact" = non-merged AND non-archived. Applied everywhere a merged
 * contact is already excluded. `includeArchived` drops ONLY the archived predicate (never the merged
 * one), for the search's "+ archived" toggle.
 */
function activeContact(includeArchived = false) {
  return and(
    isNull(contacts.mergedIntoId),
    includeArchived ? undefined : isNull(contacts.archivedAt),
  );
}

/** Below this many primary (substring) matches, we also surface fuzzy "did you mean" matches. */
const FUZZY_FLOOR = 5;

const SEARCH_COLS = {
  id: contacts.id,
  displayName: contacts.displayName,
  membershipStatus: contacts.membershipStatus,
  listMember: contacts.listMember,
  pronouns: contacts.pronouns,
  archivedAt: contacts.archivedAt, // feature 065: lets a result row be marked archived
};

/** Escape LIKE/ILIKE wildcards in a user needle (Postgres default '\' escape char). */
function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Fetch one past `limit` to detect truncation; slice back to `limit`. */
function withTruncation(rows: ContactSummary[], limit: number): ContactSearchResult {
  const truncated = rows.length > limit;
  return { items: truncated ? rows.slice(0, limit) : rows, truncated };
}

/**
 * Contact search (feature 061 / X-R3). **Substring-PRIMARY and monotonic** — a longer query yields a
 * subset, so typing narrows predictably ("cat" → "Catherine"). Matches a contact by `name_normalized`
 * ∪ `dedup_normalized` (real first/last, ignoring any display override) ∪ a **prefix** of one of their
 * active emails. Trigram similarity is a **secondary** "did you mean" fallback, appended only when the
 * primary result is thin (< FUZZY_FLOOR) and ranked below the exact set. Non-merged only. Empty `q`
 * browses the roster. Returns `{ items, truncated }` (truncated = more matched than `limit`).
 */
export async function searchContacts(
  db: Db,
  q: string,
  limit = 20,
  opts: { orderBy?: "recent" | "name"; includeArchived?: boolean } = {},
): Promise<ContactSearchResult> {
  const active = activeContact(opts.includeArchived); // feature 065
  if (!q.trim()) {
    // Browse the roster: alphabetical by last then first name for the door, else most recent.
    const order =
      opts.orderBy === "name"
        ? [sql`${contacts.lastName} ASC NULLS LAST`, contacts.firstName]
        : [desc(contacts.createdAt)];
    const rows = await db
      .select(SEARCH_COLS)
      .from(contacts)
      .where(active)
      .orderBy(...order)
      .limit(limit + 1);
    return withTruncation(rows, limit);
  }

  const needle = normalizeName(q);
  const esc = escapeLike(needle);
  const infix = `%${esc}%`;
  const prefix = `${esc}%`;

  // Primary: substring of the display name OR the dedup key (real first/last) OR an active email prefix.
  const primary = await db
    .select(SEARCH_COLS)
    .from(contacts)
    .where(
      and(
        active,
        sql`(${contacts.nameNormalized} ILIKE ${infix}
          OR ${contacts.dedupNormalized} ILIKE ${infix}
          OR EXISTS (
            SELECT 1 FROM contact_emails ce
            WHERE ce.contact_id = ${contacts.id}
              AND ce.status IN ('active', 'transition')
              AND lower(trim(ce.email::text)) LIKE ${prefix}
          ))`,
      ),
    )
    // Prefix (starts-with) matches before other substrings, then alphabetical — stable + intuitive.
    .orderBy(
      sql`CASE WHEN ${contacts.nameNormalized} ILIKE ${prefix} THEN 0 ELSE 1 END`,
      contacts.nameNormalized,
    )
    .limit(limit + 1);

  if (primary.length >= FUZZY_FLOOR) {
    return withTruncation(primary, limit);
  }

  // Thin exact results → append trigram-similar names not already present, ranked after the exact set.
  const seen = new Set(primary.map((r) => r.id));
  const fuzzy = await db
    .select(SEARCH_COLS)
    .from(contacts)
    .where(and(active, sql`${contacts.nameNormalized} % ${needle}`))
    .orderBy(sql`similarity(${contacts.nameNormalized}, ${needle}) DESC`)
    .limit(limit + 1);
  const merged = [...primary];
  for (const r of fuzzy) {
    if (seen.has(r.id)) continue;
    merged.push(r);
    if (merged.length > limit) break;
  }
  return withTruncation(merged, limit);
}

/** Feature 064: the needs-review count for the launcher button (active, flagged). */
export async function countNeedsReview(db: Db): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(contacts)
    .where(and(activeContact(), eq(contacts.needsReview, true)));
  return row?.n ?? 0;
}

/** Feature 064: the needs-review worklist — flagged, active, bounded like search, name-ordered. */
export async function listNeedsReview(db: Db, limit = 20): Promise<ContactSearchResult> {
  const rows = await db
    .select(SEARCH_COLS)
    .from(contacts)
    .where(and(activeContact(), eq(contacts.needsReview, true)))
    .orderBy(sql`${contacts.lastName} ASC NULLS LAST`, contacts.firstName)
    .limit(limit + 1);
  return withTruncation(rows, limit);
}

/** Feature 065 (M-R9): archive (retire, reversibly) — set archived_at. */
export async function archiveContact(db: Db, id: string): Promise<ContactRow> {
  const [row] = await db
    .update(contacts)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(eq(contacts.id, id))
    .returning();
  if (!row) throw errors.contactNotFound();
  return row;
}

/** Feature 065 (M-R9): restore (unarchive) — clear archived_at. */
export async function restoreContact(db: Db, id: string): Promise<ContactRow> {
  const [row] = await db
    .update(contacts)
    .set({ archivedAt: null, updatedAt: new Date() })
    .where(eq(contacts.id, id))
    .returning();
  if (!row) throw errors.contactNotFound();
  return row;
}

/**
 * Feature 065 (M-R11): the substantive tables whose reference blocks a SAFE delete — the SINGLE source
 * of truth for the guard and its parity test (C15). `contact_emails` (owned, cascades) and audit rows
 * (a log) are deliberately excluded, so a contact whose only references are its own emails is bare.
 */
export const CONTACT_DELETE_BLOCKERS = [
  { category: "membership", table: memberships, column: memberships.contactId },
  {
    category: "membership_capture",
    table: membershipCaptures,
    column: membershipCaptures.contactId,
  },
  { category: "attendance", table: attendance, column: attendance.contactId },
  { category: "gate_sale", table: gateSales, column: gateSales.contactId },
  { category: "performer", table: performers, column: performers.contactId },
  { category: "officer", table: officers, column: officers.contactId },
  { category: "role_grant", table: roleGrants, column: roleGrants.contactId },
  { category: "staff_identity", table: staffIdentities, column: staffIdentities.contactId },
  { category: "venue_landlord", table: venues, column: venues.landlordContactId },
] as const;

/**
 * Mel reads the refusal, so it must name references in her language — the categories above are table
 * slugs (`gate_sale`, `staff_identity`, `shared_email`) and mean nothing to her. Category slugs stay the
 * machine-readable contract in `error.detail`; these are only for the message.
 */
const BLOCKER_LABELS: Record<string, string> = {
  membership: "a membership",
  membership_capture: "a membership payment",
  attendance: "check-in history",
  gate_sale: "door sales",
  performer: "a performer record",
  officer: "an officer role",
  role_grant: "staff role grants",
  staff_identity: "a staff sign-in",
  venue_landlord: "a venue landlord record",
  shared_email: "other contacts reached at this contact's email",
};

export const blockerLabel = (category: string): string => BLOCKER_LABELS[category] ?? category;

async function referenced(
  db: Db,
  table: PgTable,
  column: AnyPgColumn,
  id: string,
): Promise<boolean> {
  const rows = await db
    .select({ x: sql`1` })
    .from(table)
    .where(eq(column, id))
    .limit(1);
  return rows.length > 0;
}

/** Feature 065 (M-R11): which substantive categories reference this contact (empty ⇒ bare, safe-delete). */
export async function contactDeleteBlockers(db: Db, id: string): Promise<string[]> {
  const present: string[] = [];
  for (const b of CONTACT_DELETE_BLOCKERS) {
    if (await referenced(db, b.table, b.column, id)) present.push(b.category);
  }
  // Feature 067: other contacts ride this contact's address, so deleting it would leave a household
  // unreachable. Not a plain contact_id column, so it cannot ride the generic blocker list.
  const [riders] = await db
    .select({ id: contacts.id })
    .from(contacts)
    .innerJoin(contactEmails, eq(contactEmails.id, contacts.messageRecipientEmailId))
    .where(eq(contactEmails.contactId, id))
    .limit(1);
  if (riders) present.push("shared_email");
  return present;
}

/**
 * Feature 065 (M-R11/M-R12): permanently delete a contact. The SAFE path refuses unless the contact is
 * bare; the UNRESTRICTED path (super_user) bypasses the guard. Both audit `contact.deleted`.
 */
export async function deleteContact(
  db: Db,
  id: string,
  opts: { unrestricted?: boolean; actor?: string | null } = {},
): Promise<void> {
  const existing = await db.query.contacts.findFirst({ where: eq(contacts.id, id) });
  if (!existing) throw errors.contactNotFound();
  if (!opts.unrestricted) {
    const blockers = await contactDeleteBlockers(db, id);
    if (blockers.length > 0) {
      throw errors.contactHasReferences(blockers.map(blockerLabel), blockers);
    }
  }
  // Feature 067 (FR-012): the unrestricted path bypasses the guard above, so referrers must still be
  // cleared AND flagged before the cascade takes this contact's emails. The FK alone would null their
  // pointers without a trace.
  await clearReferencesToOwner(db, id, opts.actor ?? null);
  await db.delete(contacts).where(eq(contacts.id, id));
  // Durable audit row (FR-010): every permanent deletion is recorded, safe or unrestricted.
  await recordAudit(db, {
    kind: "contact.deleted",
    actorContactId: opts.actor ?? null,
    details: { contactId: id, unrestricted: !!opts.unrestricted },
  });
}

/** Feature 064 (FR-013): the manual override — clear `needs_review` regardless of contact data. */
export async function markReviewed(db: Db, id: string): Promise<ContactRow> {
  const [row] = await db
    .update(contacts)
    .set({ needsReview: false, updatedAt: new Date() })
    .where(eq(contacts.id, id))
    .returning();
  if (!row) throw errors.contactNotFound();
  return row;
}
