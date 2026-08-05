import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { jsonReq, ctx } from "./helpers/http";
import { mappingAudit } from "@/server/db/schema";
import { GET as GET_MAPPING } from "@/app/api/qbo-mapping/route";
import { PUT as PUT_SERIES } from "@/app/api/qbo-mapping/series/[seriesId]/route";

// FR-006, FR-014 (feature 039, P6-R7): the GL account-mapping surface is gone; only the series → gate
// customer / class mapping remains. GET returns `{ series }` (no `accounts`); series edits still audit.
describe("QBO mapping config", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("returns the seeded series mapping (no accounts)", async () => {
    const res = await GET_MAPPING(jsonReq("GET", "/api/qbo-mapping"), ctx());
    const body = await res.json();
    expect(body).not.toHaveProperty("accounts");
    expect(Array.isArray(body.series)).toBe(true);
    expect(body.series.length).toBeGreaterThan(0);
  });

  it("updates a series gate customer/class and writes an audit entry", async () => {
    const mapping = await (await GET_MAPPING(jsonReq("GET", "/api/qbo-mapping"), ctx())).json();
    const seriesId = mapping.series[0].seriesId as string;
    const res = await PUT_SERIES(
      jsonReq("PUT", `/api/qbo-mapping/series/${seriesId}`, {
        gateCustomer: "Contra Gate (revised)",
        qboClass: "TNC-2026",
      }),
      ctx({ seriesId }),
    );
    expect(res.status).toBe(200);
    const audits = await db.select().from(mappingAudit).where(eq(mappingAudit.key, seriesId));
    expect(audits.length).toBe(1);
  });
});
