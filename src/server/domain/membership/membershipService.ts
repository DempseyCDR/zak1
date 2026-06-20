import { eq, sql } from "drizzle-orm";
import type { Db, DbOrTx } from "@/server/db/client";
import {
  clubSettings,
  contacts,
  memberships,
  payers,
  statusChangeAudit,
} from "@/server/db/schema";
import type { MembershipRow, MembershipStatus, PayerRow } from "@/server/db/schema";
import { errors } from "@/server/lib/apiError";
import { writeAudit } from "@/server/lib/audit";
import { classifyMembership, isListMember } from "./classify";
import type { MembershipCreateInput } from "@/server/validation/memberships";

async function getSettings(
  db: DbOrTx,
): Promise<{ longLapseCycles: number; cycleDefinition: string }> {
  const row = await db.query.clubSettings.findFirst({ where: eq(clubSettings.id, 1) });
  return {
    longLapseCycles: row?.longLapseCycles ?? 3,
    cycleDefinition: row?.cycleDefinition ?? "1 year",
  };
}

/**
 * Recompute and materialize a contact's membership status. Writes a
 * status-change audit row only when the status actually changes (idempotent).
 * Returns the resulting status.
 */
export async function recomputeContactStatus(
  db: DbOrTx,
  contactId: string,
  reason: "membership_change" | "daily_job",
  actor: string | null = null,
): Promise<{ status: MembershipStatus; changed: boolean }> {
  const settings = await getSettings(db);

  const [latest] = await db
    .select({ expiry: sql<string | null>`max(${memberships.expiryDate})` })
    .from(memberships)
    .where(eq(memberships.contactId, contactId));

  const contact = await db.query.contacts.findFirst({ where: eq(contacts.id, contactId) });
  if (!contact) throw errors.contactNotFound();

  const newStatus = classifyMembership({
    mostRecentExpiry: latest?.expiry ?? null,
    now: new Date(),
    longLapseCycles: settings.longLapseCycles,
    cycleDefinition: settings.cycleDefinition,
  });

  const changed = newStatus !== contact.membershipStatus;

  await db
    .update(contacts)
    .set({
      membershipStatus: newStatus,
      listMember: isListMember(newStatus),
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

export async function createPayer(
  db: Db,
  input: { name: string; contactId?: string | null },
): Promise<PayerRow> {
  const [row] = await db
    .insert(payers)
    .values({ name: input.name, contactId: input.contactId ?? null })
    .returning();
  if (!row) throw new Error("payer insert failed");
  return row;
}

export async function createMembership(
  db: Db,
  input: MembershipCreateInput,
  actor: string | null = null,
): Promise<MembershipRow> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(memberships)
      .values({
        contactId: input.contactId,
        payerId: input.payerId,
        expiryDate: input.expiryDate,
      })
      .returning();
    if (!row) throw new Error("membership insert failed");
    // Recompute uses the same transaction so status + audit are atomic with the insert.
    await recomputeContactStatus(tx, input.contactId, "membership_change", actor);
    return row;
  });
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
  return {
    status: contact.membershipStatus,
    listMember: contact.listMember,
    recomputedAt: contact.statusRecomputedAt ? contact.statusRecomputedAt.toISOString() : null,
  };
}

/** Recompute every contact's status (daily job). Returns scanned/changed counts. */
export async function refreshAllStatuses(
  db: Db,
): Promise<{ scanned: number; changed: number }> {
  const ids = await db.select({ id: contacts.id }).from(contacts);
  let changed = 0;
  for (const { id } of ids) {
    const result = await recomputeContactStatus(db, id, "daily_job", null);
    if (result.changed) changed++;
  }
  return { scanned: ids.length, changed };
}
