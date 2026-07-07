import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { jsonReq, ctx } from "./helpers/http";
import { venueRentAudit, venues } from "@/server/db/schema";
import { POST as CREATE_VENUE_RENT } from "@/app/api/venue-rents/route";

// FR-012, Constitution IV — venue rents get a durable audit trail (parity with series parameters).
describe("POST /api/venue-rents — audit parity", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("writes a venue_rent_audit row with the actor populated", async () => {
    const [venue] = await db.insert(venues).values({ name: "Hall", address: "1 St" }).returning();
    const res = await CREATE_VENUE_RENT(
      jsonReq("POST", "/api/venue-rents", { venueId: venue!.id, amount: 80, effectiveDate: "2026-01-01" }),
      ctx(),
    );
    expect(res.status).toBe(201);
    const audits = await db.select().from(venueRentAudit);
    expect(audits).toHaveLength(1);
    expect(audits[0]?.amountCents).toBe(8000);
    expect(audits[0]?.actor).toBeTruthy();
  });
});
