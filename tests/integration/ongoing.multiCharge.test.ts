import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { series } from "@/server/db/schema";
import {
  createExpenseParameter,
  resolveOngoingTotalCents,
} from "@/server/domain/parameters/seriesParameterService";

async function seriesId(key: string) {
  return (await db.query.series.findFirst({ where: eq(series.key, key) }))!.id;
}

// FR-008, FR-009, SC-005 — multiple concurrent labeled ongoing charges sum; each ends independently.
describe("multiple ongoing charges", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("sums concurrent labeled charges and ends one independently via a $0 entry", async () => {
    await createExpenseParameter(db, {
      seriesKey: "tnc",
      kind: "ongoing",
      label: "Supplies/insurance",
      amount: 15,
      effectiveDate: "2026-01-01",
    });
    await createExpenseParameter(db, {
      seriesKey: "tnc",
      kind: "ongoing",
      label: "Equipment loan",
      amount: 25,
      effectiveDate: "2026-01-01",
    });
    const sid = await seriesId("tnc");

    // both in effect → $40
    expect(await resolveOngoingTotalCents(db, sid, "2026-03-01")).toBe(4000);

    // end the equipment loan with a $0 entry effective 2026-07-01
    await createExpenseParameter(db, {
      seriesKey: "tnc",
      kind: "ongoing",
      label: "Equipment loan",
      amount: 0,
      effectiveDate: "2026-07-01",
    });

    // before the stop date: still $40 (both charges)
    expect(await resolveOngoingTotalCents(db, sid, "2026-06-01")).toBe(4000);
    // on/after the stop date: only supplies/insurance $15
    expect(await resolveOngoingTotalCents(db, sid, "2026-08-01")).toBe(1500);
  });
});
