import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { makeEvent } from "./helpers/factories";
import {
  getPublicHistory,
  getPublicSchedule,
  homeWindowStart,
} from "@/server/domain/public/publicSchedule";

// Feature 037 (P6-R4/R5): /what-was-on lists past dances (< today) most-recent-first; both listings
// filter by series. `before`/`from` are injectable so the window is deterministic without the wall clock.
describe("getPublicHistory", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  const ref = "2026-06-10"; // fixed reference "today"

  it("returns only events before `before`, most recent first (descending); today/future excluded", async () => {
    const older = await makeEvent({ seriesKey: "tnc", eventDate: "2026-06-08" }); // ref-2
    const newer = await makeEvent({ seriesKey: "tnc", eventDate: "2026-06-09" }); // ref-1
    const todayEv = await makeEvent({ seriesKey: "tnc", eventDate: "2026-06-10" }); // ref (excluded)
    const future = await makeEvent({ seriesKey: "tnc", eventDate: "2026-07-01" }); // excluded

    const history = await getPublicHistory(db, ref);
    expect(history.map((h) => h.eventId)).toEqual([newer.id, older.id]); // descending
    expect(history.map((h) => h.eventId)).not.toContain(todayEv.id);
    expect(history.map((h) => h.eventId)).not.toContain(future.id);
  });

  it("overlaps the home window for the last two days — same dance on both pages (FR-008/SC-002)", async () => {
    const yesterday = await makeEvent({ seriesKey: "tnc", eventDate: "2026-06-09" }); // ref-1

    const inHistory = await getPublicHistory(db, ref); // < ref
    const inSchedule = await getPublicSchedule(db, homeWindowStart(ref)); // >= ref-2

    expect(inHistory.map((h) => h.eventId)).toContain(yesterday.id);
    expect(inSchedule.map((s) => s.eventId)).toContain(yesterday.id);
  });

  it("filters history by series when a seriesKey is given (P6-R5)", async () => {
    const tnc = await makeEvent({ seriesKey: "tnc", eventDate: "2026-06-08" });
    const ecd = await makeEvent({ seriesKey: "ecd", eventDate: "2026-06-09" });

    const filtered = await getPublicHistory(db, ref, "tnc");
    expect(filtered.map((h) => h.eventId)).toEqual([tnc.id]);
    expect(filtered.map((h) => h.eventId)).not.toContain(ecd.id);
  });
});
