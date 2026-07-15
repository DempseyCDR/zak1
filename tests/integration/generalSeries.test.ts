import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { series } from "@/server/db/schema";
import {
  createRateParameter,
  resolveParameterCents,
} from "@/server/domain/parameters/seriesParameterService";

// FR-004, edge case — general series exists; no automatic fallback between series.
describe("general series", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("exists after migration and resolves a rate scoped to it", async () => {
    const general = await db.query.series.findFirst({ where: eq(series.key, "general") });
    expect(general).toBeTruthy();

    await createRateParameter(db, {
      seriesKey: "general",
      kind: "caller",
      amount: 175,
      effectiveDate: "2026-01-01",
    });
    expect(
      await resolveParameterCents(db, {
        category: "rate",
        kind: "caller",
        seriesId: general!.id,
        onDate: "2026-06-18",
      }),
    ).toBe(17500);
  });

  it("does not fall back from a standing series to general, or vice versa", async () => {
    const general = await db.query.series.findFirst({ where: eq(series.key, "general") });
    const tnc = await db.query.series.findFirst({ where: eq(series.key, "tnc") });

    // Rate set for tnc only.
    await createRateParameter(db, {
      seriesKey: "tnc",
      kind: "caller",
      amount: 150,
      effectiveDate: "2026-01-01",
    });
    expect(
      await resolveParameterCents(db, {
        category: "rate",
        kind: "caller",
        seriesId: general!.id,
        onDate: "2026-06-18",
      }),
    ).toBe(0);

    // Rate set for general only.
    await createRateParameter(db, {
      seriesKey: "general",
      kind: "sound_tech",
      amount: 90,
      effectiveDate: "2026-01-01",
    });
    expect(
      await resolveParameterCents(db, {
        category: "rate",
        kind: "sound_tech",
        seriesId: tnc!.id,
        onDate: "2026-06-18",
      }),
    ).toBe(0);
  });
});
