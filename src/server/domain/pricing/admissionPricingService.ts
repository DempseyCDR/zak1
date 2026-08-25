import { and, asc, desc, eq, inArray, lte } from "drizzle-orm";
import type { Db, DbOrTx } from "@/server/db/client";
import { admissionPrices, series } from "@/server/db/schema";
import { assertScope } from "@/server/auth/can";
import type { Actor } from "@/server/auth/actor";
import { recordAudit } from "@/server/lib/audit";
import type { AdmissionPricingSetInput } from "@/server/validation/admissionPricing";

export type AdmissionTier = { label: string; amountCents: number; sortOrder: number };
export type AdmissionRevision = { effectiveDate: string; tiers: AdmissionTier[] };

/**
 * Feature 054 (P7-R10): the tiers effective on/before `onDate` for a series — the revision (the batch of rows
 * sharing the greatest `effective_date ≤ onDate`), ordered by `sort_order`. `[]` when nothing is configured on
 * or before that date. This is the single resolution point every public price read goes through.
 */
export async function resolveAdmissionTiers(
  db: DbOrTx,
  seriesId: string,
  onDate: string,
): Promise<AdmissionTier[]> {
  const [latest] = await db
    .select({ effectiveDate: admissionPrices.effectiveDate })
    .from(admissionPrices)
    .where(and(eq(admissionPrices.seriesId, seriesId), lte(admissionPrices.effectiveDate, onDate)))
    .orderBy(desc(admissionPrices.effectiveDate))
    .limit(1);
  if (!latest) return [];
  const rows = await db
    .select({
      label: admissionPrices.label,
      amountCents: admissionPrices.amountCents,
      sortOrder: admissionPrices.sortOrder,
    })
    .from(admissionPrices)
    .where(
      and(
        eq(admissionPrices.seriesId, seriesId),
        eq(admissionPrices.effectiveDate, latest.effectiveDate),
      ),
    )
    .orderBy(asc(admissionPrices.sortOrder));
  return rows;
}

/**
 * Batch loader (feature 054, analyze F3): all revisions for several series in ONE query, grouped by series →
 * `effective_date` (descending, so the first ≤ a date is the effective one), each with its tiers ordered. The
 * public list surfaces resolve every event's price from this map in memory rather than one query per event.
 */
export async function loadRevisionsForSeries(
  db: DbOrTx,
  seriesIds: string[],
): Promise<Map<string, AdmissionRevision[]>> {
  const out = new Map<string, AdmissionRevision[]>();
  const ids = [...new Set(seriesIds)];
  if (ids.length === 0) return out;
  const rows = await db
    .select({
      seriesId: admissionPrices.seriesId,
      effectiveDate: admissionPrices.effectiveDate,
      label: admissionPrices.label,
      amountCents: admissionPrices.amountCents,
      sortOrder: admissionPrices.sortOrder,
    })
    .from(admissionPrices)
    .where(inArray(admissionPrices.seriesId, ids))
    .orderBy(desc(admissionPrices.effectiveDate), asc(admissionPrices.sortOrder));
  for (const r of rows) {
    const list = out.get(r.seriesId) ?? [];
    let rev = list.find((x) => x.effectiveDate === r.effectiveDate);
    if (!rev) {
      rev = { effectiveDate: r.effectiveDate, tiers: [] };
      list.push(rev);
    }
    rev.tiers.push({ label: r.label, amountCents: r.amountCents, sortOrder: r.sortOrder });
    out.set(r.seriesId, list);
  }
  return out;
}

/** The tiers of the revision effective on/before `onDate` (revisions must be effective_date-descending). */
export function tiersEffectiveOn(revisions: AdmissionRevision[], onDate: string): AdmissionTier[] {
  return revisions.find((r) => r.effectiveDate <= onDate)?.tiers ?? [];
}

/** All revisions for one series (effective_date-descending, tiers by sort_order) — for the admin editor. */
export async function listAdmissionRevisions(
  db: Db,
  seriesId: string,
): Promise<AdmissionRevision[]> {
  return (await loadRevisionsForSeries(db, [seriesId])).get(seriesId) ?? [];
}

/**
 * Set a series' admission pricing: append a new revision (the batch of tiers sharing `effectiveDate`) — never
 * mutates prior revisions, so history is preserved. Scope-checked (`parameter.write`, per-series for the
 * treasurer/FS) and audited. `sort_order` follows the tiers' array order.
 */
export async function setAdmissionPricing(
  db: Db,
  input: AdmissionPricingSetInput,
  actorContactId: string | null = null,
  authz?: Actor,
): Promise<void> {
  assertScope(authz, "parameter.write", { seriesId: input.seriesId });
  await db.transaction(async (tx) => {
    await tx.insert(admissionPrices).values(
      input.tiers.map((t, i) => ({
        seriesId: input.seriesId,
        effectiveDate: input.effectiveDate,
        label: t.label,
        amountCents: t.amountCents,
        sortOrder: i,
      })),
    );
    await recordAudit(tx, {
      kind: "admission_pricing.set",
      actorContactId,
      details: {
        seriesId: input.seriesId,
        effectiveDate: input.effectiveDate,
        tierCount: input.tiers.length,
      },
    });
  });
}

/** Set (or clear, with null) a series' curated standing-schedule sentence. Scope-checked + audited. */
export async function setScheduleSentence(
  db: Db,
  seriesId: string,
  sentence: string | null,
  actorContactId: string | null = null,
  authz?: Actor,
): Promise<void> {
  assertScope(authz, "parameter.write", { seriesId });
  await db.update(series).set({ scheduleSentence: sentence }).where(eq(series.id, seriesId));
  await recordAudit(db, {
    kind: "admission_pricing.set",
    actorContactId,
    details: { seriesId, scheduleSentence: sentence !== null },
  });
}
