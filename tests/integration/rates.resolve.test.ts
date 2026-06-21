import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { rateParameters } from "@/server/db/schema";
import { resolveRateCents } from "@/server/domain/bookings/resolveRate";

// FR-007, FR-008 — effective-dated resolution.
describe("resolveRateCents", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("picks the greatest effective_date ≤ the event date; 0 when none", async () => {
    await db.insert(rateParameters).values([
      { kind: "caller", amountCents: 12000, effectiveDate: "2026-01-01" },
      { kind: "caller", amountCents: 15000, effectiveDate: "2026-06-01" },
    ]);
    expect(await resolveRateCents(db, "caller", "2026-05-31")).toBe(12000);
    expect(await resolveRateCents(db, "caller", "2026-06-18")).toBe(15000);
    expect(await resolveRateCents(db, "caller", "2025-12-31")).toBe(0);
    expect(await resolveRateCents(db, "sound_tech", "2026-06-18")).toBe(0);
  });
});
