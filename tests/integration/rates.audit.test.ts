import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { jsonReq, ctx } from "./helpers/http";
import { seriesParameterAudit, seriesParameters } from "@/server/db/schema";
import { POST as CREATE_RATE } from "@/app/api/rate-parameters/route";

// FR-002, FR-008
describe("POST /api/rate-parameters", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("appends an effective-dated, series-scoped row and writes an audit entry", async () => {
    const res = await CREATE_RATE(
      jsonReq("POST", "/api/rate-parameters", {
        seriesKey: "tnc",
        kind: "caller",
        amount: 150,
        effectiveDate: "2026-06-01",
      }),
      ctx(),
    );
    expect(res.status).toBe(201);

    const rows = await db
      .select()
      .from(seriesParameters)
      .where(and(eq(seriesParameters.category, "rate"), eq(seriesParameters.kind, "caller")));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.amountCents).toBe(15000);

    const audits = await db
      .select()
      .from(seriesParameterAudit)
      .where(
        and(eq(seriesParameterAudit.category, "rate"), eq(seriesParameterAudit.kind, "caller")),
      );
    expect(audits).toHaveLength(1);
    expect(audits[0]?.amountCents).toBe(15000);
    expect(audits[0]?.actor).toBeTruthy();
  });
});
