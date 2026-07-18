import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { jsonReqAs, ctx } from "./helpers/http";
import { makeActor, makeEvent, makePerformer } from "./helpers/factories";
import { events } from "@/server/db/schema";
import { createBooking } from "@/server/domain/bookings/bookingService";
import { assembleBookingsReport } from "@/server/domain/bookings/reportService";
import { GET as REPORT } from "@/app/api/bookings/report/route";

// Feature 018 (B24): cross-event bookings report — filters, status, cancelled inclusion, base read.
describe("cross-event bookings report", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  async function seed() {
    const bob = await makePerformer("Bob Fabinski");
    const cal = await makePerformer("Cal Caller");
    const dee = await makePerformer("Dee Caller");

    const a = await makeEvent({ seriesKey: "tnc", eventDate: "2026-06-18" });
    await createBooking(db, a.id, { performerId: cal.id, performerType: "caller", pay: 150 });
    await createBooking(db, a.id, { performerId: bob.id, performerType: "musician", pay: 60 });

    const b = await makeEvent({ seriesKey: "ecd", eventDate: "2026-07-05" });
    await createBooking(db, b.id, { performerId: dee.id, performerType: "caller", pay: 150 });
    await createBooking(db, b.id, { performerId: bob.id, performerType: "musician", pay: 60 });

    const c = await makeEvent({ seriesKey: "tnc", eventDate: "2026-08-01" });
    await createBooking(db, c.id, { performerId: cal.id, performerType: "caller", pay: 150 });
    await db.update(events).set({ status: "cancelled" }).where(eq(events.id, c.id));

    return { bob, cal, dee, a, b, c };
  }

  it("filters by an individual musician across events", async () => {
    const { bob, a, b } = await seed();
    const { rows } = await assembleBookingsReport(db, { musician: bob.id });
    expect(rows.map((r) => r.eventId).sort()).toEqual([a.id, b.id].sort());
    expect(rows[0]?.bookings.some((x) => x.status === "proposed")).toBe(true); // all statuses shown
  });

  it("filters by series + date range", async () => {
    const { a } = await seed();
    const { rows } = await assembleBookingsReport(db, {
      series: "tnc",
      from: "2026-06-01",
      to: "2026-06-30",
    });
    expect(rows.map((r) => r.eventId)).toEqual([a.id]);
    expect(rows[0]?.caller).toBe("Cal Caller");
    expect(rows[0]?.musicians).toContain("Bob Fabinski");
  });

  it("includes cancelled events, flagged", async () => {
    const { c } = await seed();
    const { rows } = await assembleBookingsReport(db, { series: "tnc" });
    const cancelledRow = rows.find((r) => r.eventId === c.id);
    expect(cancelledRow?.cancelled).toBe(true);
  });

  it("is readable by a base (non-Booker) staff actor", async () => {
    await seed();
    const { token } = await makeActor({ email: "staff.reader@cdrochester.org" });
    const res = await REPORT(jsonReqAs(token, "GET", "/api/bookings/report"), ctx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rows.length).toBeGreaterThan(0);
  });
});
