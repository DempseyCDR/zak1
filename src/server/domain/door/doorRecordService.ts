import { eq } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import { doorRecordAudit, doorRecords, events, gateSales } from "@/server/db/schema";
import type { DoorRecordRow, GateSaleRow } from "@/server/db/schema";
import { errors } from "@/server/lib/apiError";
import { assertEventScope } from "@/server/auth/can";
import type { Actor } from "@/server/auth/actor";
import { writeAudit } from "@/server/lib/audit";
import { dollarsToCents, centsToDollars } from "@/server/lib/money";
import { depositCents, posFeeCents } from "./calc";
import type {
  CheckinCountsInput,
  DoorRecordPatchInput,
  GateSalesPutInput,
} from "@/server/validation/door";

/**
 * Assert a gate write against the door record's event scope (FR-020). A door record belongs to an
 * event, and the event carries the series/group an FS grant is scoped to — so a gate write resolves to
 * exactly the series the FS was granted (or was not). The Door Attendant never reaches here: they hold
 * no `gate.write` at all, so layer 1 refuses them first.
 */
async function assertGateScope(db: Db, actor: Actor | undefined, eventId: string): Promise<void> {
  if (!actor) return;
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) throw errors.eventNotFound();
  assertEventScope(actor, "gate.write", { seriesId: event.seriesId, groupId: event.groupId });
}

/** Door-record view returned to clients — the POS fee is intentionally omitted (FR-007). */
export type DoorRecordView = {
  id: string;
  eventId: string;
  posTransactionCount: number;
  pcGross: number; // derived sum of card lines (was "POS gross")
  grossCash: number; // derived sum of cash lines
  seedFloat: number;
  cashPaidOut: number;
  cashPaidOutReason: string | null;
  deposit: number;
  giftCardRedemptionCount: number;
  compCount: number;
  openBandCount: number; // feature 017 (B36): open-band comps; FS sees it read-only on /gate
};

function toView(row: DoorRecordRow): DoorRecordView {
  return {
    id: row.id,
    eventId: row.eventId,
    posTransactionCount: row.posTransactionCount,
    pcGross: centsToDollars(row.pcGrossCents),
    grossCash: centsToDollars(row.grossCashCents),
    seedFloat: centsToDollars(row.seedFloatCents),
    cashPaidOut: centsToDollars(row.cashPaidOutCents),
    cashPaidOutReason: row.cashPaidOutReason,
    deposit: centsToDollars(row.depositCents),
    giftCardRedemptionCount: row.giftCardRedemptionCount,
    compCount: row.compCount,
    openBandCount: row.openBandCount,
  };
}

export async function createDoorRecord(
  db: Db,
  eventId: string,
  actor: string | null = null,
): Promise<DoorRecordView> {
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) throw errors.eventNotFound();
  const existing = await db.query.doorRecords.findFirst({
    where: eq(doorRecords.eventId, eventId),
  });
  if (existing) throw errors.doorRecordExists();

  const [row] = await db.insert(doorRecords).values({ eventId }).returning();
  if (!row) throw new Error("door record insert failed");
  await db.insert(doorRecordAudit).values({ doorRecordId: row.id, action: "created", actor });
  writeAudit({ kind: "door_record.created", actor, details: { doorRecordId: row.id, eventId } });
  return toView(row);
}

/** Get-or-create the door record for an event (used when money/donations appear). */
export async function ensureDoorRecord(
  db: Db,
  eventId: string,
  actor: string | null = null,
): Promise<DoorRecordRow> {
  const existing = await db.query.doorRecords.findFirst({
    where: eq(doorRecords.eventId, eventId),
  });
  if (existing) return existing;
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) throw errors.eventNotFound();
  const [row] = await db.insert(doorRecords).values({ eventId }).returning();
  if (!row) throw new Error("door record insert failed");
  await db.insert(doorRecordAudit).values({ doorRecordId: row.id, action: "created", actor });
  writeAudit({ kind: "door_record.created", actor, details: { doorRecordId: row.id, eventId } });
  return row;
}

/** Update the manually-entered fields, then recompute derived totals (fee/deposit). */
export async function updateDoorRecord(
  db: Db,
  id: string,
  input: DoorRecordPatchInput,
  actor: string | null = null,
  authz?: Actor,
): Promise<DoorRecordView> {
  const current = await db.query.doorRecords.findFirst({ where: eq(doorRecords.id, id) });
  if (!current) throw errors.doorRecordNotFound();
  await assertGateScope(db, authz, current.eventId); // FR-020: the FS owns money only for their series

  const cashPaidOutCents =
    input.cashPaidOut !== undefined ? dollarsToCents(input.cashPaidOut) : current.cashPaidOutCents;
  const cashPaidOutReason =
    input.cashPaidOutReason !== undefined ? input.cashPaidOutReason : current.cashPaidOutReason;
  if (cashPaidOutCents > 0 && !cashPaidOutReason) throw errors.cashPayoutReasonRequired();

  const grossCashCents =
    input.grossCash !== undefined ? dollarsToCents(input.grossCash) : current.grossCashCents;
  const pcGrossCents =
    input.pcGross !== undefined ? dollarsToCents(input.pcGross) : current.pcGrossCents;
  const seedFloatCents =
    input.seedFloat !== undefined ? dollarsToCents(input.seedFloat) : current.seedFloatCents;
  const posTransactionCount = input.posTransactionCount ?? current.posTransactionCount;

  // Fee from card txns + PC gross; deposit = gross cash − seed float − cash paid out.
  const fee = posFeeCents(posTransactionCount, pcGrossCents);
  const deposit = depositCents(grossCashCents, seedFloatCents, cashPaidOutCents);

  const [row] = await db
    .update(doorRecords)
    .set({
      posTransactionCount,
      grossCashCents,
      pcGrossCents,
      seedFloatCents,
      cashPaidOutCents,
      cashPaidOutReason,
      posFeeCents: fee,
      depositCents: deposit,
      giftCardRedemptionCount: input.giftCardRedemptionCount ?? current.giftCardRedemptionCount,
      compCount: input.compCount ?? current.compCount,
      updatedAt: new Date(),
    })
    .where(eq(doorRecords.id, id))
    .returning();
  if (!row) throw errors.doorRecordNotFound();

  await db.insert(doorRecordAudit).values({
    doorRecordId: id,
    action: "updated",
    actor,
    details: { fields: Object.keys(input) },
  });
  writeAudit({
    kind: "door_record.updated",
    actor,
    details: { doorRecordId: id, posFeeCents: row.posFeeCents, depositCents: row.depositCents },
  });
  return toView(row);
}

/**
 * Feature 017 (B29): the Door Attendant captures comp + gift-card redemption COUNTS at check-in. This
 * is an `attendance.write` concern, NOT `gate.write` — the door record's counts vs. its money are
 * written by different roles (see capabilities.ts). It ensures the door record, sets ONLY the two
 * counts, and never touches money, `open_band_count`, or the derived deposit/fee. The FS later
 * confirms/edits the same two fields on /gate via `updateDoorRecord` (`gate.write`, FR-015).
 */
export async function recordCheckinCounts(
  db: Db,
  eventId: string,
  input: CheckinCountsInput,
  actor: string | null = null,
  authz?: Actor,
): Promise<DoorRecordView> {
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) throw errors.eventNotFound();
  // Layer 2: the Door Attendant's attendance.write, scoped to this event's series/group.
  if (authz) {
    assertEventScope(authz, "attendance.write", {
      seriesId: event.seriesId,
      groupId: event.groupId,
    });
  }

  const dr = await ensureDoorRecord(db, eventId, actor);
  const [row] = await db
    .update(doorRecords)
    .set({
      compCount: input.compCount ?? dr.compCount,
      giftCardRedemptionCount: input.giftCardRedemptionCount ?? dr.giftCardRedemptionCount,
      updatedAt: new Date(),
    })
    .where(eq(doorRecords.id, dr.id))
    .returning();
  if (!row) throw errors.doorRecordNotFound();

  await db.insert(doorRecordAudit).values({
    doorRecordId: dr.id,
    action: "checkin_counts",
    actor,
    details: { fields: Object.keys(input) },
  });
  writeAudit({
    kind: "door_record.checkin_counts",
    actor,
    details: { doorRecordId: dr.id, eventId },
  });
  return toView(row);
}

export async function putGateSales(
  db: Db,
  doorRecordId: string,
  input: GateSalesPutInput,
  authz?: Actor,
): Promise<GateSaleRow[]> {
  const dr = await db.query.doorRecords.findFirst({ where: eq(doorRecords.id, doorRecordId) });
  if (!dr) throw errors.doorRecordNotFound();
  await assertGateScope(db, authz, dr.eventId); // FR-020

  return db.transaction(async (tx) => {
    await tx.delete(gateSales).where(eq(gateSales.doorRecordId, doorRecordId));
    if (input.sales.length === 0) return [];
    return tx
      .insert(gateSales)
      .values(
        input.sales.map((s) => ({
          doorRecordId,
          category: s.category,
          paymentMethod: s.paymentMethod,
          amountCents: dollarsToCents(s.amount),
          contactId: s.contactId ?? null,
        })),
      )
      .returning();
  });
}

export async function getDoorRecord(
  db: Db,
  id: string,
): Promise<{ doorRecord: DoorRecordView; gateSales: GateSaleRow[] }> {
  const row = await db.query.doorRecords.findFirst({ where: eq(doorRecords.id, id) });
  if (!row) throw errors.doorRecordNotFound();
  const sales = await db.select().from(gateSales).where(eq(gateSales.doorRecordId, id));
  return { doorRecord: toView(row), gateSales: sales };
}
