import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { jsonReq, ctx } from "./helpers/http";
import { makeEvent } from "./helpers/factories";
import { mailingListExports } from "@/server/db/schema";
import { GET as CONTACT_TRACING } from "@/app/api/exports/contact-tracing/route";

// FR-006c, SC-003
describe("GET /api/exports/contact-tracing", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("returns { count: 0 } (not a CSV) for a selectable event with zero recorded attendance, no audit row", async () => {
    const evt = await makeEvent();
    const res = await CONTACT_TRACING(jsonReq("GET", `/api/exports/contact-tracing?eventId=${evt.id}`), ctx());
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = await res.json();
    expect(body).toEqual({ count: 0 });

    const audits = await db.select().from(mailingListExports);
    expect(audits).toHaveLength(0);
  });

  it("404s EVENT_NOT_FOUND for an unknown eventId", async () => {
    const res = await CONTACT_TRACING(
      jsonReq("GET", "/api/exports/contact-tracing?eventId=00000000-0000-0000-0000-000000000000"),
      ctx(),
    );
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("EVENT_NOT_FOUND");
  });
});
