import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { jsonReq, ctx } from "./helpers/http";
import { makeEvent, makePerformer, makeDoorRecord } from "./helpers/factories";
import { bookings, events } from "@/server/db/schema";
import { createBooking } from "@/server/domain/bookings/bookingService";
import { recordAttendance } from "@/server/domain/attendance/attendanceService";
import { DELETE as EVENT_DELETE } from "@/app/api/events/[id]/route";

async function del(id: string) {
  return EVENT_DELETE(jsonReq("DELETE", `/api/events/${id}`), ctx({ id }));
}

// Feature 018 (B25): hard delete only when the event has NO history; else 409 (cancel instead).
describe("event delete guardrail", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("deletes an empty event (204)", async () => {
    const evt = await makeEvent({ seriesKey: "tnc" });
    const res = await del(evt.id);
    expect(res.status).toBe(204);
    expect(await db.query.events.findFirst({ where: eq(events.id, evt.id) })).toBeUndefined();
  });

  it("deletes an event with a booking at a rate but NO check number (rate alone does not block)", async () => {
    const evt = await makeEvent({ seriesKey: "tnc" });
    const caller = await makePerformer("Cal Caller");
    await createBooking(db, evt.id, { performerId: caller.id, performerType: "caller", pay: 150 });
    const res = await del(evt.id);
    expect(res.status).toBe(204);
  });

  it("refuses (409) when a booking has a check number", async () => {
    const evt = await makeEvent({ seriesKey: "tnc" });
    const caller = await makePerformer("Cal Caller");
    const b = await createBooking(db, evt.id, {
      performerId: caller.id,
      performerType: "caller",
      pay: 150,
    });
    await db.update(bookings).set({ checkNumber: "1234" }).where(eq(bookings.id, b.id));
    const res = await del(evt.id);
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("EVENT_HAS_HISTORY");
  });

  it("refuses (409) when the event has attendance", async () => {
    const evt = await makeEvent({ seriesKey: "tnc" });
    await recordAttendance(db, evt.id, { unmatched: true });
    const res = await del(evt.id);
    expect(res.status).toBe(409);
  });

  it("refuses (409) when the event has a door record", async () => {
    const evt = await makeEvent({ seriesKey: "tnc" });
    await makeDoorRecord(evt.id);
    const res = await del(evt.id);
    expect(res.status).toBe(409);
  });
});
