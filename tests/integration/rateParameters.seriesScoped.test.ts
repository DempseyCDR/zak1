import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb } from "./helpers/db";
import { jsonReq, ctx } from "./helpers/http";
import { POST as CREATE_RATE, GET as GET_RATE } from "@/app/api/rate-parameters/route";

// FR-002, contracts
describe("rate-parameters route: series scoping", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("404s SERIES_NOT_FOUND for an unknown seriesKey", async () => {
    const res = await CREATE_RATE(
      jsonReq("POST", "/api/rate-parameters", {
        seriesKey: "not-a-series",
        kind: "caller",
        amount: 150,
        effectiveDate: "2026-01-01",
      }),
      ctx(),
    );
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("SERIES_NOT_FOUND");
  });

  it("GET resolves the right amount for the right series", async () => {
    await CREATE_RATE(
      jsonReq("POST", "/api/rate-parameters", {
        seriesKey: "tnc",
        kind: "caller",
        amount: 150,
        effectiveDate: "2026-01-01",
      }),
      ctx(),
    );
    const res = await GET_RATE(
      jsonReq("GET", "/api/rate-parameters?seriesKey=tnc&kind=caller&on=2026-06-18"),
      ctx(),
    );
    const body = await res.json();
    expect(body.resolved).toEqual({
      seriesKey: "tnc",
      kind: "caller",
      amount: 150,
      effectiveDate: "2026-06-18",
    });

    const other = await GET_RATE(
      jsonReq("GET", "/api/rate-parameters?seriesKey=ecd&kind=caller&on=2026-06-18"),
      ctx(),
    );
    expect((await other.json()).resolved).toBeNull();
  });
});
