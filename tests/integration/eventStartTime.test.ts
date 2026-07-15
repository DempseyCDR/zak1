import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { createEvent } from "@/server/domain/events/eventService";
import { getPublicSchedule, getPublicEventDetail } from "@/server/domain/public/publicSchedule";

// FR-003, FR-004, SC-002 — start time shown as a venue-local wall-clock value.
describe("event start time (public)", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("shows the formatted start time on the schedule and detail; null when unset", async () => {
    const withTime = await createEvent(db, {
      seriesKey: "tnc",
      eventDate: "2026-06-18",
      chargesAdmission: true,
      startTime: "19:30",
    });
    const noTime = await createEvent(db, {
      seriesKey: "tnc",
      eventDate: "2026-06-19",
      chargesAdmission: true,
    });

    const sched = await getPublicSchedule(db, "2026-01-01");
    expect(sched.find((s) => s.eventId === withTime.id)?.startTime).toBe("7:30 PM");
    expect(sched.find((s) => s.eventId === noTime.id)?.startTime).toBeNull();

    expect((await getPublicEventDetail(db, withTime.id))?.startTime).toBe("7:30 PM");
    expect((await getPublicEventDetail(db, noTime.id))?.startTime).toBeNull();
  });
});
