import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { auditEvents, series } from "@/server/db/schema";
import {
  setAdmissionPricing,
  listAdmissionRevisions,
  resolveAdmissionTiers,
} from "@/server/domain/pricing/admissionPricingService";

// Feature 054 (P7-R10): the writer — append-only revisions, audited, history preserved.
describe("setAdmissionPricing", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  async function tncId(): Promise<string> {
    const [s] = await db.select({ id: series.id }).from(series).where(eq(series.key, "tnc"));
    return s!.id;
  }

  it("inserts a revision (sort_order from array order) and writes an audit row", async () => {
    const sid = await tncId();
    await setAdmissionPricing(db, {
      seriesId: sid,
      effectiveDate: "2026-01-01",
      tiers: [
        { label: "Supporter", amountCents: 1500 },
        { label: "Dancer", amountCents: 1200 },
        { label: "Student", amountCents: 500 },
      ],
    });

    const tiers = await resolveAdmissionTiers(db, sid, "2026-02-01");
    expect(tiers.map((t) => [t.label, t.amountCents, t.sortOrder])).toEqual([
      ["Supporter", 1500, 0],
      ["Dancer", 1200, 1],
      ["Student", 500, 2],
    ]);

    const audits = await db
      .select({ kind: auditEvents.kind })
      .from(auditEvents)
      .where(eq(auditEvents.kind, "admission_pricing.set"));
    expect(audits.length).toBe(1);
  });

  it("a later revision changes resolution by date; history is preserved", async () => {
    const sid = await tncId();
    await setAdmissionPricing(db, {
      seriesId: sid,
      effectiveDate: "2026-01-01",
      tiers: [{ label: "Dancer", amountCents: 1200 }],
    });
    await setAdmissionPricing(db, {
      seriesId: sid,
      effectiveDate: "2026-06-01",
      tiers: [{ label: "Dancer", amountCents: 1300 }],
    });

    expect((await resolveAdmissionTiers(db, sid, "2026-03-01"))[0]!.amountCents).toBe(1200);
    expect((await resolveAdmissionTiers(db, sid, "2026-07-01"))[0]!.amountCents).toBe(1300);

    const revisions = await listAdmissionRevisions(db, sid);
    expect(revisions.map((r) => r.effectiveDate)).toEqual(["2026-06-01", "2026-01-01"]);
  });
});
