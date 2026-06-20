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
  posGross: number;
  grossCash: number;
  seedFloat: number;
  cashPaidOut: number;
  cashPaidOutReason: string | null;
  deposit: number;
  giftCardRedemptionCount: number;
};

function toView(row: DoorRecordRow): DoorRecordView {
  return {
    id: row.id,
    eventId: row.eventId,
    posTransactionCount: row.posTransactionCount,
    posGross: centsToDollars(row.posGrossCents),
    grossCash: centsToDollars(row.grossCashCents),
    seedFloat: centsToDollars(row.seedFloatCents),
    cashPaidOut: centsToDollars(row.cashPaidOutCents),
    cashPaidOutReason: row.cashPaidOutReason,
    deposit: centsToDollars(row.depositCents),
    giftCardRedemptionCount: row.giftCardRedemptionCount,
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

export async function updateDoorRecord(
  db: Db,
  id: string,
  input: DoorRecordPatchInput,
  actor: string | null = null,
): Promise<DoorRecordView> {
  const current = await db.query.doorRecords.findFirst({ where: eq(doorRecords.id, id) });
  if (!current) throw errors.doorRecordNotFound();

  const next = {
    posTransactionCount: input.posTransactionCount ?? current.posTransactionCount,
    posGrossCents: input.posGross !== undefined ? dollarsToCents(input.posGross) : current.posGrossCents,
    grossCashCents: input.grossCash !== undefined ? dollarsToCents(input.grossCash) : current.grossCashCents,
    seedFloatCents: input.seedFloat !== undefined ? dollarsToCents(input.seedFloat) : current.seedFloatCents,
    cashPaidOutCents:
      input.cashPaidOut !== undefined ? dollarsToCents(input.cashPaidOut) : current.cashPaidOutCents,
    cashPaidOutReason:
      input.cashPaidOutReason !== undefined ? input.cashPaidOutReason : current.cashPaidOutReason,
    giftCardRedemptionCount: input.giftCardRedemptionCount ?? current.giftCardRedemptionCount,
  };

  if (next.cashPaidOutCents > 0 && !next.cashPaidOutReason) throw errors.cashPayoutReasonRequired();

  const fee = posFeeCents(next.posTransactionCount, next.posGrossCents);
  const deposit = depositCents(next.grossCashCents, next.seedFloatCents, next.cashPaidOutCents);

  const [row] = await db
    .update(doorRecords)
    .set({ ...next, posFeeCents: fee, depositCents: deposit, updatedAt: new Date() })
    .where(eq(doorRecords.id, id))
    .returning();
  if (!row) throw errors.doorRecordNotFound();

  await db
    .insert(doorRecordAudit)
    .values({ doorRecordId: id, action: "updated", actor, details: { fields: Object.keys(input) } });
  // Fee is logged server-side for reconciliation but never returned to the door UI.
  writeAudit({
    kind: "door_record.updated",
    actor,
    details: { doorRecordId: id, posFeeCents: fee, depositCents: deposit },
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
    const rows = await tx
      .insert(gateSales)
      .values(
        input.sales.map((s) => ({
          doorRecordId,
          category: s.category,
          paymentMethod: s.paymentMethod,
          amountCents: dollarsToCents(s.amount),
        })),
      )
      .returning();
    return rows;
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
