import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { jsonReq, jsonReqAs, ctx } from "./helpers/http";
import { makeActor } from "./helpers/factories";
import { series } from "@/server/db/schema";
import { POST } from "@/app/api/admission-pricing/route";

// Feature 054 (P7-R10): admission-pricing writes are default-deny — parameter.write only (FR-007). The
// standing jsonReq session is a super_user (holds parameter.write globally) for the allow case.
describe("admission-pricing POST requires parameter.write", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  async function tncId(): Promise<string> {
    const [s] = await db.select({ id: series.id }).from(series).where(eq(series.key, "tnc"));
    return s!.id;
  }

  it("refuses a base-only actor — 403 naming parameter.write", async () => {
    const seriesId = await tncId();
    const { token } = await makeActor({
      email: "nope@cdrochester.org",
      grants: [{ role: "door_attendant" }], // no parameter.write
    });
    const res = await POST(
      jsonReqAs(token, "POST", "/api/admission-pricing", {
        seriesId,
        effectiveDate: "2026-01-01",
        tiers: [{ label: "Dancer", amountCents: 1200 }],
      }),
      ctx(),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(body.error.message).toContain("parameter.write");
  });

  it("allows a parameter.write actor (201)", async () => {
    const seriesId = await tncId();
    const res = await POST(
      jsonReq("POST", "/api/admission-pricing", {
        seriesId,
        effectiveDate: "2026-01-01",
        tiers: [{ label: "Dancer", amountCents: 1200 }],
      }),
      ctx(),
    );
    expect(res.status).toBe(201);
  });
});
