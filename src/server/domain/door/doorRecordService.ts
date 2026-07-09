import { eq } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import { doorRecordAudit, doorRecords, events, gateSales } from "@/server/db/schema";
import type { DoorRecordRow, GateSaleRow } from "@/server/db/schema";
import { errors } from "@/server/lib/apiError";
import { writeAudit } from "@/server/lib/audit";
import { dollarsToCents, centsToDollars } from "@/server/lib/money";
import { depositCents, posFeeCents } from "./calc";
import type { DoorRecordPatchInput, GateSalesPutInput } from "@/server/validation/door";

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
): Promise<DoorRecordView> {
  const current = await db.query.doorRecords.findFirst({ where: eq(doorRecords.id, id) });
  if (!current) throw errors.doorRecordNotFound();

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

  await db
    .insert(doorRecordAudit)
    .values({ doorRecordId: id, action: "updated", actor, details: { fields: Object.keys(input) } });
  writeAudit({
    kind: "door_record.updated",
    actor,
    details: { doorRecordId: id, posFeeCents: row.posFeeCents, depositCents: row.depositCents },
  });
  return toView(row);
}

export async function putGateSales(
  db: Db,
  doorRecordId: string,
  input: GateSalesPutInput,
): Promise<GateSaleRow[]> {
  const dr = await db.query.doorRecords.findFirst({ where: eq(doorRecords.id, doorRecordId) });
  if (!dr) throw errors.doorRecordNotFound();

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
