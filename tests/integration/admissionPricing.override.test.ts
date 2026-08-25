import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { makeEvent } from "./helpers/factories";
import { events, series } from "@/server/db/schema";
import { setAdmissionPricing } from "@/server/domain/pricing/admissionPricingService";
import { getPublicEventDetail } from "@/server/domain/public/publicSchedule";

// Feature 054 (P7-R10): a special event's flat override (events.advertised_price_cents, feature 018) wins on
// the public projection; a sibling with no override shows the series tiers; clearing reverts.
describe("per-event pricing override (public projection)", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("override → flat on that event only; sibling → tiers; clearing reverts", async () => {
    const [s] = await db.select({ id: series.id }).from(series).where(eq(series.key, "tnc"));
    await setAdmissionPricing(db, {
      seriesId: s!.id,
      effectiveDate: "2026-01-01",
      tiers: [
        { label: "Dancer", amountCents: 1200 },
        { label: "Student", amountCents: 500 },
      ],
    });

    const special = await makeEvent({ seriesKey: "tnc", eventDate: "2026-06-18" });
    const sibling = await makeEvent({ seriesKey: "tnc", eventDate: "2026-06-25" });
    await db.update(events).set({ advertisedPriceCents: 2500 }).where(eq(events.id, special.id));

    const specialDetail = await getPublicEventDetail(db, special.id);
    expect(specialDetail!.pricing).toEqual({ kind: "flat", amount: 25 });

    const siblingDetail = await getPublicEventDetail(db, sibling.id);
    expect(siblingDetail!.pricing).toEqual({
      kind: "tiers",
      tiers: [
        { label: "Dancer", amount: 12 },
        { label: "Student", amount: 5 },
      ],
    });

    // Clear the override → reverts to the series tiers.
    await db.update(events).set({ advertisedPriceCents: null }).where(eq(events.id, special.id));
    const reverted = await getPublicEventDetail(db, special.id);
    expect(reverted!.pricing).toEqual({
      kind: "tiers",
      tiers: [
        { label: "Dancer", amount: 12 },
        { label: "Student", amount: 5 },
      ],
    });
  });
});
