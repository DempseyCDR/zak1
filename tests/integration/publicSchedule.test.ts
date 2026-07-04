import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { makeEvent } from "./helpers/factories";
import { events, venues } from "@/server/db/schema";
import { getPublicSchedule } from "@/server/domain/public/publicSchedule";

// FR-001, FR-010
describe("getPublicSchedule", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  const cutoff = "2026-06-01"; // fixed reference so the test doesn't depend on the wall clock

  it("returns events on/after the cutoff, ascending, with activity + venue name; past excluded", async () => {
    const past = await makeEvent({ seriesKey: "tnc", eventDate: "2026-01-01" });
    const soon = await makeEvent({ seriesKey: "tnc", eventDate: "2026-06-18" });
    const later = await makeEvent({ seriesKey: "ecd", eventDate: "2026-07-05" });

    const [v] = await db.insert(venues).values({ name: "German House", address: "315 Gregory St" }).returning();
    await db.update(events).set({ venueId: v!.id }).where(eq(events.id, soon.id));

    const schedule = await getPublicSchedule(db, cutoff);
    expect(schedule.map((s) => s.eventId)).toEqual([soon.id, later.id]); // ascending, past excluded
    expect(schedule.map((s) => s.eventId)).not.toContain(past.id);

    const soonItem = schedule.find((s) => s.eventId === soon.id)!;
    expect(soonItem.activity).toBe("Thursday Night Contra");
    expect(soonItem.venueName).toBe("German House");

    const laterItem = schedule.find((s) => s.eventId === later.id)!;
    expect(laterItem.venueName).toBeNull(); // no venue assigned
  });

  it("includes a free event (chargesAdmission = false) in the schedule", async () => {
    const free = await makeEvent({ seriesKey: "community_dance", eventDate: "2026-06-20", chargesAdmission: false });
    const schedule = await getPublicSchedule(db, cutoff);
    expect(schedule.map((s) => s.eventId)).toContain(free.id);
  });
});
