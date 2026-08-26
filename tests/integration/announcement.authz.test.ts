import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb } from "./helpers/db";
import { jsonReq, jsonReqAs, ctx } from "./helpers/http";
import { makeActor } from "./helpers/factories";
import { POST, DELETE } from "@/app/api/announcement/route";

// Feature 056 (P7-R13): posting/clearing the site-wide banner is default-deny — content.write only. The
// standing jsonReq session is a super_user (holds content.write) for the allow case; a scoped door_attendant
// is the refusal case.
describe("announcement POST/DELETE require content.write", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  const body = { text: "Snow day", level: "info", durationHours: 24, link: null };

  it("refuses a base-only actor on POST — 403 naming content.write", async () => {
    const { token } = await makeActor({
      email: "nope@cdrochester.org",
      grants: [{ role: "door_attendant" }], // no content.write
    });
    const res = await POST(jsonReqAs(token, "POST", "/api/announcement", body), ctx());
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error.code).toBe("UNAUTHORIZED");
    expect(json.error.message).toContain("content.write");
  });

  it("refuses a base-only actor on DELETE — 403", async () => {
    const { token } = await makeActor({
      email: "nope2@cdrochester.org",
      grants: [{ role: "door_attendant" }],
    });
    const res = await DELETE(jsonReqAs(token, "DELETE", "/api/announcement"), ctx());
    expect(res.status).toBe(403);
  });

  it("allows a content.write actor to POST", async () => {
    const res = await POST(jsonReq("POST", "/api/announcement", body), ctx());
    expect(res.status).toBe(201);
  });

  it("rejects a javascript: link with 422 (bad scheme)", async () => {
    const res = await POST(
      jsonReq("POST", "/api/announcement", {
        ...body,
        link: { label: "Bad", url: "javascript:alert(1)" },
      }),
      ctx(),
    );
    expect(res.status).toBe(422);
  });

  it("allows a content.write actor to DELETE (clear)", async () => {
    await POST(jsonReq("POST", "/api/announcement", body), ctx());
    const res = await DELETE(jsonReq("DELETE", "/api/announcement"), ctx());
    expect(res.status).toBe(200);
  });
});
