import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { makeEvent } from "./helpers/factories";
import { events } from "@/server/db/schema";
import { recordAttendance } from "@/server/domain/attendance/attendanceService";
import { attendanceSchema } from "@/server/validation/attendance";

// Feature 025 US3 (FR-015): an unmatched head-count admission may carry a children count — previously the
// strict schema rejected it, silently dropping the number.
describe("unmatched admission with children", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("accepts childrenCount on the unmatched path and lands it in the head count", async () => {
    // The validation boundary now admits it (the regression was here).
    expect(attendanceSchema.safeParse({ unmatched: true, childrenCount: 2 }).success).toBe(true);
    // ...but still rejects open-band on the anonymous path.
    expect(attendanceSchema.safeParse({ unmatched: true, isOpenBand: true }).success).toBe(false);

    const evt = await makeEvent();
    await recordAttendance(db, evt.id, { unmatched: true, childrenCount: 2 });
    const e = await db.query.events.findFirst({ where: eq(events.id, evt.id) });
    expect(e!.attendanceCount).toBe(3); // 1 admission + 2 children
  });
});
