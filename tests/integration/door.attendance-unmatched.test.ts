import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb } from "./helpers/db";
import { jsonReq, ctx } from "./helpers/http";
import { makeEvent } from "./helpers/factories";
import { POST as ATTEND } from "@/app/api/events/[id]/attendance/route";

// FR-004
describe("POST /api/events/:id/attendance (unmatched)", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("records an unmatched attendance with null contact", async () => {
    const evt = await makeEvent();
    const res = await ATTEND(
      jsonReq("POST", `/api/events/${evt.id}/attendance`, { unmatched: true }),
      ctx({ id: evt.id }),
    );
    expect(res.status).toBe(201);
    expect((await res.json()).contactId).toBeNull();
  });
});
