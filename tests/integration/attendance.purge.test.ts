import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { makeEvent } from "./helpers/factories";
import { attendance, quarterlyAttendanceCounts, series } from "@/server/db/schema";
import { purgeOldAttendance } from "@/server/domain/attendance/retentionService";

// FR-011
describe("purgeOldAttendance", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  async function seedOldAttendance(eventId: string, n: number) {
    for (let i = 0; i < n; i++) {
      await db.insert(attendance).values({ eventId, contactId: null });
    }
    // age all attendance for this event past the 90-day window
    await db
      .update(attendance)
      .set({ createdAt: sql`now() - interval '100 days'` })
      .where(eq(attendance.eventId, eventId));
  }

  it("rolls >90-day attendance into quarterly counts, deletes rows, and is idempotent", async () => {
    // event in Q2 2026 (June)
    const evt = await makeEvent({ seriesKey: "tnc", eventDate: "2026-06-18" });
    await seedOldAttendance(evt.id, 5);

    const first = await purgeOldAttendance(db);
    expect(first.rolledUp).toBe(5);
    expect(first.purged).toBe(5);

    const tnc = await db.query.series.findFirst({ where: eq(series.key, "tnc") });
    const counts = await db
      .select()
      .from(quarterlyAttendanceCounts)
      .where(eq(quarterlyAttendanceCounts.seriesId, tnc!.id));
    expect(counts).toHaveLength(1);
    expect(counts[0]?.year).toBe(2026);
    expect(counts[0]?.quarter).toBe(2);
    expect(counts[0]?.attendeeCount).toBe(5);

    // rows deleted
    const remaining = await db.select().from(attendance).where(eq(attendance.eventId, evt.id));
    expect(remaining).toHaveLength(0);

    // idempotent: second run changes nothing, count unchanged
    const second = await purgeOldAttendance(db);
    expect(second.purged).toBe(0);
    const countsAfter = await db
      .select()
      .from(quarterlyAttendanceCounts)
      .where(eq(quarterlyAttendanceCounts.seriesId, tnc!.id));
    expect(countsAfter[0]?.attendeeCount).toBe(5);
  });
});
