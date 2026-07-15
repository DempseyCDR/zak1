import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { jsonReq, ctx } from "./helpers/http";
import { seriesParameterAudit } from "@/server/db/schema";
import { POST as CREATE_EXPENSE } from "@/app/api/expense-parameters/route";

// FR-010 — ongoing expense parameters are labeled and write a durable audit row.
describe("POST /api/expense-parameters — audit parity", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("writes a series_parameter_audit row (ongoing) with the actor and label populated", async () => {
    const res = await CREATE_EXPENSE(
      jsonReq("POST", "/api/expense-parameters", {
        seriesKey: "tnc",
        kind: "ongoing",
        label: "Supplies/insurance",
        amount: 15,
        effectiveDate: "2026-01-01",
      }),
      ctx(),
    );
    expect(res.status).toBe(201);

    const audits = await db
      .select()
      .from(seriesParameterAudit)
      .where(
        and(eq(seriesParameterAudit.category, "expense"), eq(seriesParameterAudit.kind, "ongoing")),
      );
    expect(audits).toHaveLength(1);
    expect(audits[0]?.amountCents).toBe(1500);
    expect(audits[0]?.label).toBe("Supplies/insurance");
    expect(audits[0]?.actor).toBeTruthy();
  });
});
