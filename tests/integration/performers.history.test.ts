import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb } from "./helpers/db";
import { jsonReq, ctx } from "./helpers/http";
import { makeEvent, makePerformer } from "./helpers/factories";
import { POST as BOOK } from "@/app/api/events/[id]/bookings/route";
import { GET as GET_PERFORMER } from "@/app/api/performers/[id]/route";

// FR-010, SC-002
describe("performer appearance history + YTD earnings", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("counts donated appearances but excludes them from YTD earnings", async () => {
    const year = new Date().getUTCFullYear();
    const paidEvent = await makeEvent({ eventDate: `${year}-03-01` });
    const donatedEvent = await makeEvent({ eventDate: `${year}-04-01` });
    const p = await makePerformer("History Caller");

    await BOOK(
      jsonReq("POST", `/api/events/${paidEvent.id}/bookings`, {
        performerId: p.id,
        performerType: "caller",
        pay: 150,
      }),
      ctx({ id: paidEvent.id }),
    );
    await BOOK(
      jsonReq("POST", `/api/events/${donatedEvent.id}/bookings`, {
        performerId: p.id,
        performerType: "caller",
        isDonated: true,
      }),
      ctx({ id: donatedEvent.id }),
    );

    const res = await GET_PERFORMER(jsonReq("GET", `/api/performers/${p.id}`), ctx({ id: p.id }));
    const body = await res.json();
    expect(body.appearanceCount).toBe(2); // both appearances counted
    expect(body.ytdEarnings).toBe(150); // donated excluded
  });
});
