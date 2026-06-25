import { eq } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import { events, nonDanceIncome } from "@/server/db/schema";
import type { NonDanceIncomeRow } from "@/server/db/schema";
import { errors } from "@/server/lib/apiError";
import { centsToDollars, dollarsToCents } from "@/server/lib/money";
import type { NonDanceIncomeCreateInput } from "@/server/validation/treasurer";

export async function createNonDanceIncome(
  db: Db,
  eventId: string,
  input: NonDanceIncomeCreateInput,
): Promise<NonDanceIncomeRow> {
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) throw errors.eventNotFound();
  const [row] = await db
    .insert(nonDanceIncome)
    .values({
      eventId,
      description: input.description,
      amountCents: dollarsToCents(input.amount),
      entryDate: input.entryDate,
    })
    .returning();
  if (!row) throw new Error("non-dance income insert failed");
  return row;
}

export async function listNonDanceIncome(
  db: Db,
  eventId: string,
): Promise<{ items: NonDanceIncomeRow[]; total: number }> {
  const items = await db.select().from(nonDanceIncome).where(eq(nonDanceIncome.eventId, eventId));
  const total = centsToDollars(items.reduce((a, r) => a + r.amountCents, 0));
  return { items, total };
}
