import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { jsonReq, ctx } from "./helpers/http";
import { makeEvent } from "./helpers/factories";
import { events } from "@/server/db/schema";
import { PATCH as EVENT_PATCH } from "@/app/api/events/[id]/route";
import { getPublicSchedule } from "@/server/domain/public/publicSchedule";

// Feature 018 (B25): cancel is a retained, public-visible state; revive restores it.
describe("event cancel / revive", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("cancels (retained) and shows the event marked cancelled on the public schedule", async () => {
    const evt = await makeEvent({ seriesKey: "tnc", eventDate: "2026-06-18" });
    const res = await EVENT_PATCH(
      jsonReq("PATCH", `/api/events/${evt.id}`, { status: "cancelled" }),
      ctx({ id: evt.id }),
    );
    expect(res.status).toBe(200);

    // Still exists (retained), now cancelled.
    const row = await db.query.events.findFirst({ where: eq(events.id, evt.id) });
    expect(row?.status).toBe("cancelled");

    // Shown on the public schedule with the cancelled marker.
    const schedule = await getPublicSchedule(db, "2026-01-01");
    const item = schedule.find((s) => s.eventId === evt.id);
    expect(item).toBeDefined();
    expect(item?.cancelled).toBe(true);
  });

  it("revives a cancelled event", async () => {
    const evt = await makeEvent({ seriesKey: "tnc", eventDate: "2026-06-18" });
    await EVENT_PATCH(
      jsonReq("PATCH", `/api/events/${evt.id}`, { status: "cancelled" }),
      ctx({ id: evt.id }),
    );
    await EVENT_PATCH(
      jsonReq("PATCH", `/api/events/${evt.id}`, { status: "scheduled" }),
      ctx({ id: evt.id }),
    );
    const row = await db.query.events.findFirst({ where: eq(events.id, evt.id) });
    expect(row?.status).toBe("scheduled");
  });
});
