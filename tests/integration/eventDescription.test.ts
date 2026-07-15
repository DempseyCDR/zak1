import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { createEvent } from "@/server/domain/events/eventService";
import { getPublicEventDetail } from "@/server/domain/public/publicSchedule";

// FR-005, FR-006, SC-003 — the public event detail shows a description when present.
describe("event description (public detail)", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("returns the description when set, and null when absent", async () => {
    const withDesc = await createEvent(db, {
      seriesKey: "tnc",
      eventDate: "2026-06-18",
      chargesAdmission: true,
      description: "Contra with the Wednesday Band.",
    });
    const noDesc = await createEvent(db, {
      seriesKey: "tnc",
      eventDate: "2026-06-19",
      chargesAdmission: true,
    });

    expect((await getPublicEventDetail(db, withDesc.id))?.description).toBe(
      "Contra with the Wednesday Band.",
    );
    expect((await getPublicEventDetail(db, noDesc.id))?.description).toBeNull();
  });
});
