import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb } from "./helpers/db";
import { jsonReq, ctx } from "./helpers/http";
import { makeEvent, makePerformer } from "./helpers/factories";
import { POST as BOOK } from "@/app/api/events/[id]/bookings/route";

// FR-006
describe("donated bookings", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("books a donated Caller at $0 with no check", async () => {
    const evt = await makeEvent();
    const p = await makePerformer("Donor Caller");
    const res = await BOOK(
      jsonReq("POST", `/api/events/${evt.id}/bookings`, {
        performerId: p.id,
        performerType: "caller",
        isDonated: true,
      }),
      ctx({ id: evt.id }),
    );
    expect(res.status).toBe(201);
    const b = await res.json();
    expect(b.payCents).toBe(0);
    expect(b.isDonated).toBe(true);
    expect(b.requiresCheck).toBe(false);
  });
});
