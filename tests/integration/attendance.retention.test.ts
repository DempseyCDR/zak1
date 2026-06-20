import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { makeEvent } from "./helpers/factories";
import { attendance, quarterlyAttendanceCounts } from "@/server/db/schema";
import { purgeOldAttendance } from "@/server/domain/attendance/retentionService";

// FR-011 — recent attendance is retained and not yet counted.
describe("attendance retention window", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("keeps attendance within 90 days and does not roll it up", async () => {
    const evt = await makeEvent();
    await db.insert(attendance).values({ eventId: evt.id, contactId: null }); // created_at = now

    const result = await purgeOldAttendance(db);
    expect(result.purged).toBe(0);

    const remaining = await db.select().from(attendance).where(eq(attendance.eventId, evt.id));
    expect(remaining).toHaveLength(1);

    const counts = await db.select().from(quarterlyAttendanceCounts);
    expect(counts).toHaveLength(0);
  });
});
