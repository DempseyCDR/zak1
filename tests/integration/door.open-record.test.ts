import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { jsonReq, ctx } from "./helpers/http";
import { makeEvent } from "./helpers/factories";
import { doorRecords } from "@/server/db/schema";
import { POST as OPEN } from "@/app/api/events/[id]/door-record/route";

// FR-015 — idempotent open (create-or-fetch) of an event's door record.
describe("POST /api/events/:id/door-record", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("creates the door record on first open and returns the same one thereafter", async () => {
    const evt = await makeEvent();

    const first = await OPEN(jsonReq("POST", `/api/events/${evt.id}/door-record`), ctx({ id: evt.id }));
    expect(first.status).toBe(200);
    const firstBody = await first.json();
    expect(firstBody.doorRecord.id).toBeTruthy();
    expect(firstBody.gateSales).toEqual([]);

    const second = await OPEN(jsonReq("POST", `/api/events/${evt.id}/door-record`), ctx({ id: evt.id }));
    const secondBody = await second.json();
    expect(secondBody.doorRecord.id).toBe(firstBody.doorRecord.id);

    // exactly one door record for the event
    const rows = await db.select().from(doorRecords).where(eq(doorRecords.eventId, evt.id));
    expect(rows).toHaveLength(1);
  });

  it("404s for an unknown event", async () => {
    const res = await OPEN(
      jsonReq("POST", `/api/events/00000000-0000-0000-0000-000000000000/door-record`),
      ctx({ id: "00000000-0000-0000-0000-000000000000" }),
    );
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("EVENT_NOT_FOUND");
  });
});
