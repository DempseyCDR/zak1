import { and, desc, eq, lte } from "drizzle-orm";
import type { Db, DbOrTx } from "@/server/db/client";
import { series, seriesParameterAudit, seriesParameters } from "@/server/db/schema";
import type { ParameterCategory, ParameterKind, SeriesParameterRow } from "@/server/db/schema";
import { errors } from "@/server/lib/apiError";
import { writeAudit } from "@/server/lib/audit";
import { dollarsToCents } from "@/server/lib/money";
import type { RateParameterCreateInput } from "@/server/validation/performers";
import type { ExpenseParameterCreateInput } from "@/server/validation/organizer";

/**
 * Resolve the amount (cents) in effect for (category, kind, series, date): the row with the
 * greatest effective_date ≤ onDate. Returns 0 when none is configured. Identical rule for
 * every category/kind — no branching.
 */
export async function resolveParameterCents(
  db: DbOrTx,
  input: { category: ParameterCategory; kind: ParameterKind; seriesId: string; onDate: string },
): Promise<number> {
  const [row] = await db
    .select({ amountCents: seriesParameters.amountCents })
    .from(seriesParameters)
    .where(
      and(
        eq(seriesParameters.category, input.category),
        eq(seriesParameters.kind, input.kind),
        eq(seriesParameters.seriesId, input.seriesId),
        lte(seriesParameters.effectiveDate, input.onDate),
      ),
    )
    .orderBy(desc(seriesParameters.effectiveDate))
    .limit(1);
  return row?.amountCents ?? 0;
}

/**
 * Total ongoing charge (cents) for a series on a date: for each distinct label, the amount from the
 * row with the greatest effective_date ≤ onDate, summed. A label whose latest row is $0 contributes 0
 * (an ended charge). Supports multiple concurrent labeled ongoing charges (feature 011).
 */
export async function resolveOngoingTotalCents(
  db: DbOrTx,
  seriesId: string,
  onDate: string,
): Promise<number> {
  const rows = await db
    .select({
      label: seriesParameters.label,
      amountCents: seriesParameters.amountCents,
    })
    .from(seriesParameters)
    .where(
      and(
        eq(seriesParameters.category, "expense"),
        eq(seriesParameters.kind, "ongoing"),
        eq(seriesParameters.seriesId, seriesId),
        lte(seriesParameters.effectiveDate, onDate),
      ),
    )
    .orderBy(seriesParameters.label, desc(seriesParameters.effectiveDate));

  const seen = new Set<string>();
  let total = 0;
  for (const r of rows) {
    const key = r.label ?? "";
    if (seen.has(key)) continue; // first per label = latest (ordered by effective_date desc)
    seen.add(key);
    total += r.amountCents;
  }
  return total;
}

async function createSeriesParameter(
  db: Db,
  input: {
    category: ParameterCategory;
    seriesKey: string;
    kind: ParameterKind;
    amountCents: number;
    label: string | null;
    effectiveDate: string;
  },
  actor: string | null,
): Promise<SeriesParameterRow> {
  const s = await db.query.series.findFirst({ where: eq(series.key, input.seriesKey) });
  if (!s) throw errors.seriesNotFound();
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(seriesParameters)
      .values({
        category: input.category,
        kind: input.kind,
        seriesId: s.id,
        amountCents: input.amountCents,
        label: input.label,
        effectiveDate: input.effectiveDate,
      })
      .returning();
    if (!row) throw new Error("series parameter insert failed");
    await tx.insert(seriesParameterAudit).values({
      category: input.category,
      kind: input.kind,
      seriesId: s.id,
      amountCents: input.amountCents,
      label: input.label,
      effectiveDate: input.effectiveDate,
      actor,
    });
    writeAudit({
      kind: input.category === "rate" ? "rate_parameter.created" : "expense_parameter.created",
      actor,
      details: { seriesKey: input.seriesKey, kind: input.kind, amountCents: input.amountCents },
    });
    return row;
  });
}

export async function createRateParameter(
  db: Db,
  input: RateParameterCreateInput,
  actor: string | null = null,
): Promise<SeriesParameterRow> {
  return createSeriesParameter(
    db,
    {
      category: "rate",
      seriesKey: input.seriesKey,
      kind: input.kind,
      amountCents: dollarsToCents(input.amount),
      label: null,
      effectiveDate: input.effectiveDate,
    },
    actor,
  );
}

export async function createExpenseParameter(
  db: Db,
  input: ExpenseParameterCreateInput,
  actor: string | null = null,
): Promise<SeriesParameterRow> {
  return createSeriesParameter(
    db,
    {
      category: "expense",
      seriesKey: input.seriesKey,
      kind: input.kind,
      amountCents: dollarsToCents(input.amount),
      label: input.label ?? null,
      effectiveDate: input.effectiveDate,
    },
    actor,
  );
}
