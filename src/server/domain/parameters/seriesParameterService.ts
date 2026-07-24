import { and, desc, eq, lte } from "drizzle-orm";
import type { Db, DbOrTx } from "@/server/db/client";
import { series, seriesParameterAudit, seriesParameters } from "@/server/db/schema";
import type { ParameterCategory, ParameterKind, SeriesParameterRow } from "@/server/db/schema";
import { errors } from "@/server/lib/apiError";
import { assertScope } from "@/server/auth/can";
import type { Actor } from "@/server/auth/actor";
import { writeAudit } from "@/server/lib/audit";
import { dollarsToCents } from "@/server/lib/money";
import type { RateParameterCreateInput } from "@/server/validation/performers";
import type { ExpenseParameterCreateInput } from "@/server/validation/organizer";
import type { DoorParameterCreateInput } from "@/server/validation/door";

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
 * Feature 019 US5 (R4): like `resolveParameterCents`, but returns `null` when NOTHING is configured —
 * distinct from a configured `0`. The seed float needs this distinction: unconfigured means "apply the
 * club default" (FR-024), whereas a configured `$0` means a series that runs no float. Collapsing them (as
 * the `?? 0` resolver does) would silently open a door record at $0 and over-report the deposit. The
 * existing resolver is deliberately left unchanged — its `0` is correct for rates and expenses.
 */
export async function resolveParameterCentsOrNull(
  db: DbOrTx,
  input: { category: ParameterCategory; kind: ParameterKind; seriesId: string; onDate: string },
): Promise<number | null> {
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
  return row?.amountCents ?? null;
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
  authz?: Actor,
): Promise<SeriesParameterRow> {
  const s = await db.query.series.findFirst({ where: eq(series.key, input.seriesKey) });
  if (!s) throw errors.seriesNotFound();
  // Parameters are per-series (row 9): a Booker sets their OWN series' rates; the Treasurer any. No
  // group axis here — parameters attach to a series, not an event.
  assertScope(authz, "parameter.write", { seriesId: s.id });
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
      kind:
        input.category === "rate"
          ? "rate_parameter.created"
          : input.category === "door"
            ? "door_parameter.created"
            : "expense_parameter.created",
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
  authz?: Actor,
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
    authz,
  );
}

export async function createExpenseParameter(
  db: Db,
  input: ExpenseParameterCreateInput,
  actor: string | null = null,
  authz?: Actor,
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
    authz,
  );
}

/** Feature 019 US5 (FR-021/FR-026): the per-series seed float, gated by `parameter.write` like the rest. */
export async function createDoorParameter(
  db: Db,
  input: DoorParameterCreateInput,
  actor: string | null = null,
  authz?: Actor,
): Promise<SeriesParameterRow> {
  return createSeriesParameter(
    db,
    {
      category: "door",
      seriesKey: input.seriesKey,
      kind: "seed_float",
      amountCents: dollarsToCents(input.amount),
      label: null,
      effectiveDate: input.effectiveDate,
    },
    actor,
    authz,
  );
}
