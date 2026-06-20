import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb } from "./helpers/db";
import { jsonReq, ctx } from "./helpers/http";
import { POST as CREATE_GROUP } from "@/app/api/event-groups/route";
import { POST as CREATE_EVENT } from "@/app/api/events/route";

// FR-013
describe("event groups", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("creates a group and an event assigned to it", async () => {
    const gRes = await CREATE_GROUP(
      jsonReq("POST", "/api/event-groups", { name: "Spring Weekend 2026", kind: "weekend" }),
      ctx(),
    );
    expect(gRes.status).toBe(201);
    const group = await gRes.json();

    const eRes = await CREATE_EVENT(
      jsonReq("POST", "/api/events", {
        seriesKey: "tnc",
        eventDate: "2026-05-01",
        groupId: group.id,
      }),
      ctx(),
    );
    expect(eRes.status).toBe(201);
    expect((await eRes.json()).groupId).toBe(group.id);
  });

  it("rejects an event with an unknown groupId (404 EVENT_GROUP_NOT_FOUND)", async () => {
    const res = await CREATE_EVENT(
      jsonReq("POST", "/api/events", {
        seriesKey: "tnc",
        eventDate: "2026-05-01",
        groupId: "00000000-0000-0000-0000-000000000000",
      }),
      ctx(),
    );
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("EVENT_GROUP_NOT_FOUND");
  });
});
