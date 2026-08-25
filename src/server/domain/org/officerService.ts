import { eq } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import { contacts, officers } from "@/server/db/schema";
import { CLUB_ROLES, isBoardRoleKey } from "@/server/domain/org/clubRoles";
import { errors } from "@/server/lib/apiError";
import { recordAudit } from "@/server/lib/audit";

// Feature 055 (P7-R12): the public contact-directory projection + officer admin writes. The PUBLIC projection
// is PII-GATED — it carries only name + role + alias (never a contact email/phone), the gate living in the
// type. Display order and role name/alias are the committed registry's; only the person is stored per role.

export type PublicOfficer = { roleName: string; emailAlias: string; name: string | null };

/** Compose the public display name from first + last (last optional) — the only contact columns read. */
function displayName(first: string, last: string | null): string {
  return last ? `${first} ${last}` : first;
}

/**
 * The public contact directory: EVERY club role in registry order, each with its alias and — for board-seat
 * roles that have a designated officer — the officer's name (null otherwise). This single list drives the
 * merged `/contact-us` page (board officers + function aliases in one place).
 */
export async function listContactRoles(db: Db): Promise<PublicOfficer[]> {
  const rows = await db
    .select({ roleKey: officers.roleKey, first: contacts.firstName, last: contacts.lastName })
    .from(officers)
    .innerJoin(contacts, eq(contacts.id, officers.contactId));
  const nameByRole = new Map(rows.map((r) => [r.roleKey, displayName(r.first, r.last)]));
  return [...CLUB_ROLES]
    .sort((a, b) => a.order - b.order)
    .map((r) => ({
      roleName: r.roleName,
      emailAlias: r.emailAlias,
      name: nameByRole.get(r.key) ?? null,
    }));
}

/** Admin read: current assignments (role → contact + name) for the officer editor. */
export async function listOfficerAssignments(
  db: Db,
): Promise<{ roleKey: string; contactId: string; name: string }[]> {
  const rows = await db
    .select({
      roleKey: officers.roleKey,
      contactId: officers.contactId,
      first: contacts.firstName,
      last: contacts.lastName,
    })
    .from(officers)
    .innerJoin(contacts, eq(contacts.id, officers.contactId));
  return rows.map((r) => ({
    roleKey: r.roleKey,
    contactId: r.contactId,
    name: displayName(r.first, r.last),
  }));
}

/** Assign (upsert) or clear (`contactId=null`) the holder of a board-seat role. Audited. */
export async function setOfficer(
  db: Db,
  roleKey: string,
  contactId: string | null,
  actorContactId: string | null,
): Promise<void> {
  if (!isBoardRoleKey(roleKey)) {
    throw errors.validation(`"${roleKey}" is not a board-seat role`);
  }
  if (contactId === null) {
    await db.delete(officers).where(eq(officers.roleKey, roleKey));
  } else {
    await db
      .insert(officers)
      .values({ roleKey, contactId })
      .onConflictDoUpdate({
        target: officers.roleKey,
        set: { contactId, updatedAt: new Date() },
      });
  }
  await recordAudit(db, {
    kind: "officer.set",
    actorContactId,
    details: { roleKey, contactId },
  });
}
