import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { jsonReq, ctx } from "./helpers/http";
import { rateParameterAudit, rateParameters } from "@/server/db/schema";
import { POST as CREATE_RATE } from "@/app/api/rate-parameters/route";

// FR-007, FR-011
describe("POST /api/rate-parameters", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("appends an effective-dated row and writes an audit entry", async () => {
    const res = await CREATE_RATE(
      jsonReq("POST", "/api/rate-parameters", {
        kind: "caller",
        amount: 150,
        effectiveDate: "2026-06-01",
      }),
      ctx(),
    );
    expect(res.status).toBe(201);

    const rows = await db.select().from(rateParameters).where(eq(rateParameters.kind, "caller"));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.amountCents).toBe(15000);

    const audits = await db
      .select()
      .from(rateParameterAudit)
      .where(eq(rateParameterAudit.rateKind, "caller"));
    expect(audits).toHaveLength(1);
    expect(audits[0]?.amountCents).toBe(15000);
    expect(audits[0]?.actor).toBeTruthy();
  });
});
