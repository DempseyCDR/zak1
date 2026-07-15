import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import {
  createEvent,
  createEventGroup,
  updateEventDetails,
} from "@/server/domain/events/eventService";
import { getPublicSchedule } from "@/server/domain/public/publicSchedule";

// FR-001, FR-002, SC-001 — a short label tells same-day, same-group events apart.
describe("event label", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("distinguishes two same-group, same-day events by label; a rename applies", async () => {
    const group = await createEventGroup(db, { name: "Pride Dance 2026" });
    const a = await createEvent(db, {
      seriesKey: "tnc",
      eventDate: "2026-06-20",
      chargesAdmission: true,
      groupId: group.id,
      label: "Afternoon",
    });
    const b = await createEvent(db, {
      seriesKey: "tnc",
      eventDate: "2026-06-20",
      chargesAdmission: true,
      groupId: group.id,
      label: "Evening",
    });

    const sched = await getPublicSchedule(db, "2026-01-01");
    expect(sched.find((s) => s.eventId === a.id)?.label).toBe("Afternoon");
    expect(sched.find((s) => s.eventId === b.id)?.label).toBe("Evening");

    await updateEventDetails(db, a.id, { label: "Matinee" });
    const sched2 = await getPublicSchedule(db, "2026-01-01");
    expect(sched2.find((s) => s.eventId === a.id)?.label).toBe("Matinee");
  });

  it("an event with no label yields null", async () => {
    const e = await createEvent(db, {
      seriesKey: "tnc",
      eventDate: "2026-06-21",
      chargesAdmission: true,
    });
    const sched = await getPublicSchedule(db, "2026-01-01");
    expect(sched.find((s) => s.eventId === e.id)?.label).toBeNull();
  });
});
