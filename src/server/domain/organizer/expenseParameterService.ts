import { and, desc, eq, lte } from "drizzle-orm";
import type { Db, DbOrTx } from "@/server/db/client";
import { series, seriesExpenseParameters } from "@/server/db/schema";
import type { SeriesExpenseKind, SeriesExpenseParameterRow } from "@/server/db/schema";
import { errors } from "@/server/lib/apiError";
import { writeAudit } from "@/server/lib/audit";
import { dollarsToCents } from "@/server/lib/money";
import type { ExpenseParameterCreateInput } from "@/server/validation/organizer";

export async function createExpenseParameter(
  db: Db,
  input: ExpenseParameterCreateInput,
  actor: string | null = null,
): Promise<SeriesExpenseParameterRow> {
  const s = await db.query.series.findFirst({ where: eq(series.key, input.seriesKey) });
  if (!s) throw errors.seriesNotFound();
  const [row] = await db
    .insert(seriesExpenseParameters)
    .values({
      seriesId: s.id,
      kind: input.kind,
      amountCents: dollarsToCents(input.amount),
      label: input.label ?? null,
      effectiveDate: input.effectiveDate,
    })
    .returning();
  if (!row) throw new Error("expense parameter insert failed");
  writeAudit({
    kind: "expense_parameter.created",
    actor,
    details: { seriesKey: input.seriesKey, kind: input.kind, amountCents: row.amountCents },
  });
  return row;
}

/** Resolve the amount (cents) for a series+kind on a date (greatest effective_date ≤ date); 0 if none. */
export async function resolveExpenseCents(
  db: DbOrTx,
  seriesId: string,
  kind: SeriesExpenseKind,
  onDate: string,
): Promise<number> {
  const [row] = await db
    .select({ amountCents: seriesExpenseParameters.amountCents })
    .from(seriesExpenseParameters)
    .where(
      and(
        eq(seriesExpenseParameters.seriesId, seriesId),
        eq(seriesExpenseParameters.kind, kind),
        lte(seriesExpenseParameters.effectiveDate, onDate),
      ),
    )
    .orderBy(desc(seriesExpenseParameters.effectiveDate))
    .limit(1);
  return row?.amountCents ?? 0;
}
