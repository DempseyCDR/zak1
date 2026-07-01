import { eq } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import { events, miscExpenses } from "@/server/db/schema";
import type { MiscExpenseRow } from "@/server/db/schema";
import { errors } from "@/server/lib/apiError";
import { centsToDollars, dollarsToCents } from "@/server/lib/money";
import type { MiscExpenseCreateInput } from "@/server/validation/organizer";

export async function createMiscExpense(
  db: Db,
  eventId: string,
  input: MiscExpenseCreateInput,
): Promise<MiscExpenseRow> {
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) throw errors.eventNotFound();
  const [row] = await db
    .insert(miscExpenses)
    .values({ eventId, description: input.description, amountCents: dollarsToCents(input.amount) })
    .returning();
  if (!row) throw new Error("misc expense insert failed");
  return row;
}

export async function listMiscExpenses(
  db: Db,
  eventId: string,
): Promise<{ items: MiscExpenseRow[]; total: number }> {
  const items = await db.select().from(miscExpenses).where(eq(miscExpenses.eventId, eventId));
  return { items, total: centsToDollars(items.reduce((a, r) => a + r.amountCents, 0)) };
}
