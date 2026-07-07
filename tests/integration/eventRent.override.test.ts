import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb } from "./helpers/db";
import { jsonReq, ctx } from "./helpers/http";
import { makeEvent } from "./helpers/factories";
import { PATCH } from "@/app/api/events/[id]/route";

// FR-003 — the event PATCH endpoint sets and clears a per-event rent override.
describe("PATCH /api/events/[id] — per-event rent override", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("sets a rent override, then clears it back to null", async () => {
    const evt = await makeEvent({ seriesKey: "tnc", eventDate: "2026-06-01" });

    const set = await PATCH(
      jsonReq("PATCH", `/api/events/${evt.id}`, { rentCents: 12000 }),
      ctx({ id: evt.id }),
    );
    expect(set.status).toBe(200);
    expect((await set.json()).rentCents).toBe(12000);

    const cleared = await PATCH(
      jsonReq("PATCH", `/api/events/${evt.id}`, { rentCents: null }),
      ctx({ id: evt.id }),
    );
    expect(cleared.status).toBe(200);
    expect((await cleared.json()).rentCents).toBeNull();
  });
});
