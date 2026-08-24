import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb } from "./helpers/db";
import { jsonReq, jsonReqAs, ctx } from "./helpers/http";
import { makeActor } from "./helpers/factories";
import { POST as CREATE } from "@/app/api/content/route";
import { PATCH } from "@/app/api/content/[id]/route";
import { POST as PUBLISH } from "@/app/api/content/[id]/publish/route";
import { POST as PREVIEW } from "@/app/api/content/preview/route";

// Feature 051 (P7-R7): the content admin is default-deny (FR-005) — only `content.write` may create/edit/
// publish/preview. The standing jsonReq session is a super_user (holds content.write) for the allow case.
const NIL = "00000000-0000-0000-0000-000000000000";

describe("content routes require content.write", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("refuses a base-only actor on create — 403 naming content.write", async () => {
    const { token } = await makeActor({
      email: "nope@cdrochester.org",
      grants: [{ role: "door_attendant" }], // no content.write
    });
    const res = await CREATE(
      jsonReqAs(token, "POST", "/api/content", { slug: "mission", title: "M", draftBody: "x" }),
      ctx(),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(body.error.message).toContain("content.write");
  });

  it("refuses a base-only actor on patch, publish, and preview", async () => {
    const { token } = await makeActor({
      email: "nope2@cdrochester.org",
      grants: [{ role: "door_attendant" }],
    });
    const patch = await PATCH(
      jsonReqAs(token, "PATCH", `/api/content/${NIL}`, { title: "x" }),
      ctx({ id: NIL }),
    );
    expect(patch.status).toBe(403);
    const pub = await PUBLISH(
      jsonReqAs(token, "POST", `/api/content/${NIL}/publish`),
      ctx({ id: NIL }),
    );
    expect(pub.status).toBe(403);
    const prev = await PREVIEW(
      jsonReqAs(token, "POST", "/api/content/preview", { markdown: "# x" }),
      ctx(),
    );
    expect(prev.status).toBe(403);
  });

  it("allows a content.write actor to create (201)", async () => {
    const res = await CREATE(
      jsonReq("POST", "/api/content", { slug: "mission", title: "M", draftBody: "hello" }),
      ctx(),
    );
    expect(res.status).toBe(201);
  });
});
