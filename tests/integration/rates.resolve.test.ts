import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { series, seriesParameters } from "@/server/db/schema";
import { resolveParameterCents } from "@/server/domain/parameters/seriesParameterService";

// FR-002, FR-003 — effective-dated resolution, now series-scoped.
describe("resolveParameterCents", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("picks the greatest effective_date ≤ the event date, scoped to a series; 0 when none", async () => {
    const tnc = await db.query.series.findFirst({ where: eq(series.key, "tnc") });
    await db.insert(seriesParameters).values([
      { category: "rate", kind: "caller", seriesId: tnc!.id, amountCents: 12000, effectiveDate: "2026-01-01" },
      { category: "rate", kind: "caller", seriesId: tnc!.id, amountCents: 15000, effectiveDate: "2026-06-01" },
    ]);
    expect(
      await resolveParameterCents(db, { category: "rate", kind: "caller", seriesId: tnc!.id, onDate: "2026-05-31" }),
    ).toBe(12000);
    expect(
      await resolveParameterCents(db, { category: "rate", kind: "caller", seriesId: tnc!.id, onDate: "2026-06-18" }),
    ).toBe(15000);
    expect(
      await resolveParameterCents(db, { category: "rate", kind: "caller", seriesId: tnc!.id, onDate: "2025-12-31" }),
    ).toBe(0);
    expect(
      await resolveParameterCents(db, { category: "rate", kind: "sound_tech", seriesId: tnc!.id, onDate: "2026-06-18" }),
    ).toBe(0);
  });
});
