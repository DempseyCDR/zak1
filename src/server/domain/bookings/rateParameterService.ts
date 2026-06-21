import type { Db } from "@/server/db/client";
import { rateParameterAudit, rateParameters } from "@/server/db/schema";
import type { RateKind, RateParameterRow } from "@/server/db/schema";
import { writeAudit } from "@/server/lib/audit";
import { dollarsToCents } from "@/server/lib/money";
import { resolveRateCents } from "./resolveRate";
import type { RateParameterCreateInput } from "@/server/validation/performers";

export async function createRateParameter(
  db: Db,
  input: RateParameterCreateInput,
  actor: string | null = null,
): Promise<RateParameterRow> {
  const amountCents = dollarsToCents(input.amount);
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(rateParameters)
      .values({ kind: input.kind, amountCents, effectiveDate: input.effectiveDate })
      .returning();
    if (!row) throw new Error("rate parameter insert failed");
    await tx.insert(rateParameterAudit).values({
      rateKind: input.kind,
      amountCents,
      effectiveDate: input.effectiveDate,
      actor,
    });
    writeAudit({
      kind: "rate_parameter.created",
      actor,
      details: { kind: input.kind, amountCents, effectiveDate: input.effectiveDate },
    });
    return row;
  });
}

export async function resolveRate(
  db: Db,
  kind: RateKind,
  onDate: string,
): Promise<{ kind: RateKind; amount: number; effectiveDate: string } | null> {
  const cents = await resolveRateCents(db, kind, onDate);
  if (cents === 0) return null;
  return { kind, amount: cents / 100, effectiveDate: onDate };
}
