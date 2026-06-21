import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb } from "./helpers/db";
import { jsonReq, ctx } from "./helpers/http";
import { makeEvent, makePerformer } from "./helpers/factories";
import { POST as BOOK } from "@/app/api/events/[id]/bookings/route";

// FR-001/002/003/005
describe("booking type rules", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  async function book(eventId: string, performerType: string, extra: object = {}) {
    const p = await makePerformer(`${performerType} performer`);
    const res = await BOOK(
      jsonReq("POST", `/api/events/${eventId}/bookings`, { performerId: p.id, performerType, ...extra }),
      ctx({ id: eventId }),
    );
    return res;
  }

  it("forces Instructor and Open Band to $0 / no check", async () => {
    const evt = await makeEvent();
    const instr = await book(evt.id, "instructor", { pay: 100 });
    const ib = await instr.json();
    expect(ib.payCents).toBe(0);
    expect(ib.requiresCheck).toBe(false);

    const open = await book(evt.id, "open_band_musician", { pay: 50 });
    const ob = await open.json();
    expect(ob.payCents).toBe(0);
    expect(ob.requiresCheck).toBe(false);
  });

  it("makes a paid Caller require a check", async () => {
    const evt = await makeEvent();
    const res = await book(evt.id, "caller", { pay: 150 });
    const b = await res.json();
    expect(b.payCents).toBe(15000);
    expect(b.requiresCheck).toBe(true);
  });
});
