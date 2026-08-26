import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb } from "./helpers/db";
import { jsonReq, jsonReqAs, ctx } from "./helpers/http";
import { makeActor } from "./helpers/factories";
import { POST } from "@/app/api/campaigns/route";
import { PATCH, DELETE } from "@/app/api/campaigns/[id]/route";

// Feature 057 (P7-R14): campaign writes are default-deny — content.write only. The standing jsonReq session is a
// super_user (holds content.write) for the allow case; a scoped door_attendant is the refusal case.
describe("campaign POST/PATCH/DELETE require content.write", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  const body = {
    heading: "Golden Weekend",
    blurb: "Three days of dancing",
    cta: { label: "Learn more", url: "/golden-weekend" },
    startDate: "2026-11-01",
    endDate: "2026-11-30",
  };

  const SOME_ID = "00000000-0000-0000-0000-000000000000";

  it("refuses a base-only actor on POST — 403 naming content.write", async () => {
    const { token } = await makeActor({
      email: "nope@cdrochester.org",
      grants: [{ role: "door_attendant" }], // no content.write
    });
    const res = await POST(jsonReqAs(token, "POST", "/api/campaigns", body), ctx());
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error.code).toBe("UNAUTHORIZED");
    expect(json.error.message).toContain("content.write");
  });

  it("refuses a base-only actor on PATCH and DELETE — 403", async () => {
    const { token } = await makeActor({
      email: "nope2@cdrochester.org",
      grants: [{ role: "door_attendant" }],
    });
    const patch = await PATCH(
      jsonReqAs(token, "PATCH", `/api/campaigns/${SOME_ID}`, body),
      ctx({ id: SOME_ID }),
    );
    expect(patch.status).toBe(403);
    const del = await DELETE(
      jsonReqAs(token, "DELETE", `/api/campaigns/${SOME_ID}`),
      ctx({ id: SOME_ID }),
    );
    expect(del.status).toBe(403);
  });

  it("allows a content.write actor to POST", async () => {
    const res = await POST(jsonReq("POST", "/api/campaigns", body), ctx());
    expect(res.status).toBe(201);
  });

  it("rejects a javascript: CTA with 422 (bad scheme)", async () => {
    const res = await POST(
      jsonReq("POST", "/api/campaigns", {
        ...body,
        cta: { label: "Bad", url: "javascript:alert(1)" },
      }),
      ctx(),
    );
    expect(res.status).toBe(422);
  });

  it("returns 404 when PATCHing an unknown id (as a content.write actor)", async () => {
    const res = await PATCH(
      jsonReq("PATCH", `/api/campaigns/${SOME_ID}`, body),
      ctx({ id: SOME_ID }),
    );
    expect(res.status).toBe(404);
  });
});
