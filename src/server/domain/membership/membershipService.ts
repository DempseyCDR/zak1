import { eq } from "drizzle-orm";
import type { Db, DbOrTx } from "@/server/db/client";
import { contacts, statusChangeAudit } from "@/server/db/schema";
import type { MembershipStatus } from "@/server/db/schema";
import { errors } from "@/server/lib/apiError";
import { writeAudit } from "@/server/lib/audit";
import { contactMembership } from "./membershipStatus";

/**
 * Recompute and materialize a contact's membership status. Writes a status-change audit row only when the
 * status actually changes (idempotent). Returns the resulting status.
 *
 * Feature 068: the stored columns are now a CACHE — status is derived where it is read (FR-015). This
 * keeps the cache honest on write and is what the one-off backfill below drives.
 */
export async function recomputeContactStatus(
  db: DbOrTx,
  contactId: string,
  reason: "membership_change" | "daily_job",
  actor: string | null = null,
): Promise<{ status: MembershipStatus; changed: boolean }> {
  const contact = await db.query.contacts.findFirst({ where: eq(contacts.id, contactId) });
  if (!contact) throw errors.contactNotFound();

  // Derived from the ACCOUNTS covering this contact (FR-010), never from per-person membership rows.
  // `list_member` follows ATTACHMENT (FR-011) rather than `isListMember(status)`, which encoded the
  // superseded "has any membership history" rule — that is why someone who lapsed years ago and someone
  // covered today were indistinguishable.
  const derived = await contactMembership(db, contactId);
  const newStatus = derived.status;
  const changed = newStatus !== contact.membershipStatus;

  await db
    .update(contacts)
    .set({
      membershipStatus: newStatus,
      listMember: derived.isMember,
      statusRecomputedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(contacts.id, contactId));

  if (changed) {
    await db.insert(statusChangeAudit).values({
      contactId,
      fromStatus: contact.membershipStatus,
      toStatus: newStatus,
      reason,
      actor,
    });
    writeAudit({
      kind: "membership.status_change",
      actor,
      details: { contactId, from: contact.membershipStatus, to: newStatus, reason },
    });
  }

  return { status: newStatus, changed };
}

export type MembershipStatusView = {
  status: MembershipStatus;
  listMember: boolean;
  recomputedAt: string | null;
};

export async function getMembershipStatus(
  db: Db,
  contactId: string,
): Promise<MembershipStatusView> {
  const contact = await db.query.contacts.findFirst({ where: eq(contacts.id, contactId) });
  if (!contact) throw errors.contactNotFound();
  // Feature 068 (FR-015): a read surface, so it DERIVES rather than reporting the cached column.
  const derived = await contactMembership(db, contactId);
  return {
    status: derived.status,
    listMember: derived.isMember,
    recomputedAt: contact.statusRecomputedAt ? contact.statusRecomputedAt.toISOString() : null,
  };
}

/**
 * Feature 068 (FR-015a): the ONE-OFF correction.
 *
 * Status is derived where it is read, so this is not a scheduled job — the club runs no scheduler, and
 * nothing depends on this having been run recently. It exists to bring the stored CACHE into line after a
 * boundary has passed (118 memberships went stale on 1 September 2026) and after the account migration.
 */
export async function refreshAllStatuses(db: Db): Promise<{ scanned: number; changed: number }> {
  const ids = await db.select({ id: contacts.id }).from(contacts);
  let changed = 0;
  for (const { id } of ids) {
    const result = await recomputeContactStatus(db, id, "daily_job", null);
    if (result.changed) changed++;
  }
  return { scanned: ids.length, changed };
}
