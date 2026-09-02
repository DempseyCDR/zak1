import { and, count, desc, eq, isNull, sql } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import { contactEmails, contacts } from "@/server/db/schema";
import type { ContactRow } from "@/server/db/schema";
import { errors } from "@/server/lib/apiError";
import { writeAudit } from "@/server/lib/audit";
import { deriveContactNames, normalizeName } from "./normalize";
import { normalizePhone } from "./phone";
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
  return { ...contact, emails };
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
  "id" | "displayName" | "membershipStatus" | "listMember" | "pronouns"
>;

export type ContactSearchResult = { items: ContactSummary[]; truncated: boolean };

/** Below this many primary (substring) matches, we also surface fuzzy "did you mean" matches. */
const FUZZY_FLOOR = 5;

const SEARCH_COLS = {
  id: contacts.id,
  displayName: contacts.displayName,
  membershipStatus: contacts.membershipStatus,
  listMember: contacts.listMember,
  pronouns: contacts.pronouns,
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
  opts: { orderBy?: "recent" | "name" } = {},
): Promise<ContactSearchResult> {
  if (!q.trim()) {
    // Browse the roster: alphabetical by last then first name for the door, else most recent.
    const order =
      opts.orderBy === "name"
        ? [sql`${contacts.lastName} ASC NULLS LAST`, contacts.firstName]
        : [desc(contacts.createdAt)];
    const rows = await db
      .select(SEARCH_COLS)
      .from(contacts)
      .where(isNull(contacts.mergedIntoId))
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
        isNull(contacts.mergedIntoId),
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
    .where(and(isNull(contacts.mergedIntoId), sql`${contacts.nameNormalized} % ${needle}`))
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

/** Feature 064: the needs-review count for the launcher button (active, non-merged, flagged). */
export async function countNeedsReview(db: Db): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(contacts)
    .where(and(isNull(contacts.mergedIntoId), eq(contacts.needsReview, true)));
  return row?.n ?? 0;
}

/** Feature 064: the needs-review worklist — flagged, non-merged, bounded like search, name-ordered. */
export async function listNeedsReview(db: Db, limit = 20): Promise<ContactSearchResult> {
  const rows = await db
    .select(SEARCH_COLS)
    .from(contacts)
    .where(and(isNull(contacts.mergedIntoId), eq(contacts.needsReview, true)))
    .orderBy(sql`${contacts.lastName} ASC NULLS LAST`, contacts.firstName)
    .limit(limit + 1);
  return withTruncation(rows, limit);
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
