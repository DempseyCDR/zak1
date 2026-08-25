import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { admissionPrices, series } from "@/server/db/schema";
import { resolveAdmissionTiers } from "@/server/domain/pricing/admissionPricingService";
import { resolveEventPricing } from "@/server/domain/public/publicPricing";

// Feature 054 (P7-R10): effective-dated resolution + the per-event flat override + the unconfigured→null case.
describe("admission pricing resolution", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  async function tncId(): Promise<string> {
    const [s] = await db.select({ id: series.id }).from(series).where(eq(series.key, "tnc"));
    return s!.id;
  }

  async function seedRevision(
    seriesId: string,
    effectiveDate: string,
    tiers: { label: string; amountCents: number }[],
  ): Promise<void> {
    await db
      .insert(admissionPrices)
      .values(
        tiers.map((t, i) => ({
          seriesId,
          effectiveDate,
          label: t.label,
          amountCents: t.amountCents,
          sortOrder: i,
        })),
      );
  }

  it("resolves the latest revision on/before the date, ordered by sort_order", async () => {
    const sid = await tncId();
    await seedRevision(sid, "2026-01-01", [
      { label: "Supporter", amountCents: 1500 },
      { label: "Dancer", amountCents: 1200 },
      { label: "Student", amountCents: 500 },
    ]);
    await seedRevision(sid, "2026-06-01", [
      { label: "Supporter", amountCents: 1600 },
      { label: "Dancer", amountCents: 1300 },
    ]);

    const early = await resolveAdmissionTiers(db, sid, "2026-03-15");
    expect(early.map((t) => [t.label, t.amountCents])).toEqual([
      ["Supporter", 1500],
      ["Dancer", 1200],
      ["Student", 500],
    ]);
    const later = await resolveAdmissionTiers(db, sid, "2026-07-01");
    expect(later.map((t) => t.amountCents)).toEqual([1600, 1300]);
    // Before any revision → none.
    expect(await resolveAdmissionTiers(db, sid, "2025-12-31")).toEqual([]);
  });

  it("resolveEventPricing: series tiers by date, flat override wins, unconfigured → null", async () => {
    const sid = await tncId();
    await seedRevision(sid, "2026-01-01", [
      { label: "Dancer", amountCents: 1200 },
      { label: "Student", amountCents: 500 },
    ]);

    // Series default (no override) → tiers in dollars.
    expect(
      await resolveEventPricing(db, {
        seriesId: sid,
        eventDate: "2026-02-01",
        advertisedPriceCents: null,
      }),
    ).toEqual({
      kind: "tiers",
      tiers: [
        { label: "Dancer", amount: 12 },
        { label: "Student", amount: 5 },
      ],
    });
    // A special's flat override wins.
    expect(
      await resolveEventPricing(db, {
        seriesId: sid,
        eventDate: "2026-02-01",
        advertisedPriceCents: 2500,
      }),
    ).toEqual({ kind: "flat", amount: 25 });
    // A series with no pricing on/before the date and no override → null.
    expect(
      await resolveEventPricing(db, {
        seriesId: sid,
        eventDate: "2025-01-01",
        advertisedPriceCents: null,
      }),
    ).toBeNull();
  });
});
