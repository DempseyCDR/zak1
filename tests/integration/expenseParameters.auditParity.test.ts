import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { jsonReq, ctx } from "./helpers/http";
import { seriesParameterAudit } from "@/server/db/schema";
import { POST as CREATE_EXPENSE } from "@/app/api/expense-parameters/route";

// FR-008, SC-005 — expense parameters gain the audit table rate parameters already had.
describe("POST /api/expense-parameters — audit parity", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("writes a series_parameter_audit row with the actor populated", async () => {
    const res = await CREATE_EXPENSE(
      jsonReq("POST", "/api/expense-parameters", {
        seriesKey: "tnc",
        kind: "rent",
        amount: 80,
        effectiveDate: "2026-01-01",
      }),
      ctx(),
    );
    expect(res.status).toBe(201);

    const audits = await db
      .select()
      .from(seriesParameterAudit)
      .where(and(eq(seriesParameterAudit.category, "expense"), eq(seriesParameterAudit.kind, "rent")));
    expect(audits).toHaveLength(1);
    expect(audits[0]?.amountCents).toBe(8000);
    expect(audits[0]?.actor).toBeTruthy();
  });
});
