import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb } from "./helpers/db";
import { jsonReq, ctx } from "./helpers/http";
import { makeEvent, makePerformer } from "./helpers/factories";
import { POST as BOOK, GET as LIST } from "@/app/api/events/[id]/bookings/route";

// FR-009, SC-004
describe("performer total", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("returns performerTotal equal to the sum of booking pays", async () => {
    const evt = await makeEvent();
    const caller = await makePerformer("Caller");
    const musician = await makePerformer("Musician");
    await BOOK(
      jsonReq("POST", `/api/events/${evt.id}/bookings`, { performerId: caller.id, performerType: "caller", pay: 150 }),
      ctx({ id: evt.id }),
    );
    await BOOK(
      jsonReq("POST", `/api/events/${evt.id}/bookings`, { performerId: musician.id, performerType: "lead_musician", pay: 100 }),
      ctx({ id: evt.id }),
    );

    const res = await LIST(jsonReq("GET", `/api/events/${evt.id}/bookings`), ctx({ id: evt.id }));
    const body = await res.json();
    expect(body.bookings).toHaveLength(2);
    expect(body.performerTotal).toBe(250);
    const sum = body.bookings.reduce((a: number, b: { payCents: number }) => a + b.payCents, 0);
    expect(sum / 100).toBe(body.performerTotal);
  });
});
