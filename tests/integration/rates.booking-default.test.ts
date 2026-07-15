import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { jsonReq, ctx } from "./helpers/http";
import { makeEvent, makePerformer } from "./helpers/factories";
import { series, seriesParameters } from "@/server/db/schema";
import { POST as BOOK } from "@/app/api/events/[id]/bookings/route";

// FR-002, FR-003, SC-001
describe("booking defaults to the in-effect series-scoped rate", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("uses the rate in effect on the event date for the event's series, and override sets is_overridden", async () => {
    const evt = await makeEvent({ eventDate: "2026-06-18" }); // defaults to seriesKey "tnc"
    const tnc = await db.query.series.findFirst({ where: eq(series.key, "tnc") });
    await db.insert(seriesParameters).values([
      {
        category: "rate",
        kind: "caller",
        seriesId: tnc!.id,
        amountCents: 12000,
        effectiveDate: "2026-01-01",
      },
      {
        category: "rate",
        kind: "caller",
        seriesId: tnc!.id,
        amountCents: 15000,
        effectiveDate: "2026-06-01",
      },
    ]);
    const p1 = await makePerformer("Default Caller");
    const p2 = await makePerformer("Override Caller");

    const def = await BOOK(
      jsonReq("POST", `/api/events/${evt.id}/bookings`, {
        performerId: p1.id,
        performerType: "caller",
      }),
      ctx({ id: evt.id }),
    );
    const defBody = await def.json();
    expect(defBody.payCents).toBe(15000);
    expect(defBody.isOverridden).toBe(false);

    const ovr = await BOOK(
      jsonReq("POST", `/api/events/${evt.id}/bookings`, {
        performerId: p2.id,
        performerType: "caller",
        pay: 200,
      }),
      ctx({ id: evt.id }),
    );
    const ovrBody = await ovr.json();
    expect(ovrBody.payCents).toBe(20000);
    expect(ovrBody.isOverridden).toBe(true);
  });
});
