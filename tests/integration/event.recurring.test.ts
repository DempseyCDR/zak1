import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { jsonReq, jsonReqAs, ctx } from "./helpers/http";
import { makeActor } from "./helpers/factories";
import { events, series } from "@/server/db/schema";
import { updateEventDetails } from "@/server/domain/events/eventService";
import { POST as RECURRING } from "@/app/api/events/recurring/route";

async function seriesId(key: string): Promise<string> {
  const row = await db.query.series.findFirst({ where: eq(series.key, key) });
  if (!row) throw new Error(`series ${key} not seeded`);
  return row.id;
}

// Feature 018 (B26): recurring event generation — independent rows, capped, empty range.
describe("recurring event generation", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("generates independent events; cancelling one leaves the others untouched", async () => {
    const res = await RECURRING(
      jsonReq("POST", "/api/events/recurring", {
        seriesKey: "tnc",
        firstDate: "2026-01-08",
        lastDate: "2026-01-29",
        everyNWeeks: 1,
        startTime: "19:30",
      }),
      ctx(),
    );
    expect(res.status).toBe(201);
    const created = (await res.json()).events as { id: string; eventDate: string }[];
    expect(created).toHaveLength(4);
    expect(created.every((e) => e.eventDate)).toBe(true);

    // Cancel one → siblings unchanged.
    await updateEventDetails(db, created[0]!.id, { status: "cancelled" });
    const others = await Promise.all(
      created.slice(1).map((e) => db.query.events.findFirst({ where: eq(events.id, e.id) })),
    );
    expect(others.every((e) => e?.status === "scheduled")).toBe(true);
  });

  it("creates nothing for an empty range", async () => {
    const res = await RECURRING(
      jsonReq("POST", "/api/events/recurring", {
        seriesKey: "tnc",
        firstDate: "2026-02-01",
        lastDate: "2026-01-01",
      }),
      ctx(),
    );
    expect(res.status).toBe(201);
    expect((await res.json()).events).toHaveLength(0);
  });

  it("refuses a run over the 60-event cap (422)", async () => {
    const res = await RECURRING(
      jsonReq("POST", "/api/events/recurring", {
        seriesKey: "tnc",
        firstDate: "2026-01-01",
        lastDate: "2028-01-01", // ~104 weeks
        everyNWeeks: 1,
      }),
      ctx(),
    );
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe("RECURRENCE_TOO_LARGE");
  });

  it("is scoped: a Booker may only generate into their own series", async () => {
    const { token } = await makeActor({
      email: "booker.ecd@cdrochester.org",
      grants: [{ role: "booker", seriesId: await seriesId("ecd") }],
    });
    const res = await RECURRING(
      jsonReqAs(token, "POST", "/api/events/recurring", {
        seriesKey: "tnc", // NOT their series
        firstDate: "2026-01-08",
        lastDate: "2026-01-15",
      }),
      ctx(),
    );
    expect(res.status).toBe(403);
  });
});
