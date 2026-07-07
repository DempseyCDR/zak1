import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { makeEvent, makeDoorRecord, makePerformer } from "./helpers/factories";
import { attendance, events } from "@/server/db/schema";
import { updateDoorRecord } from "@/server/domain/door/doorRecordService";
import { createBooking } from "@/server/domain/bookings/bookingService";
import { recordAttendance } from "@/server/domain/attendance/attendanceService";
import { purgeOldAttendance } from "@/server/domain/attendance/retentionService";
import { assembleOrganizerReport } from "@/server/domain/organizer/reportService";

const year = 2026;

describe("organizer report", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("computes a per-dance row's Dance Net and metrics (FR-002/003/006/013)", async () => {
    const evt = await makeEvent({ seriesKey: "tnc", eventDate: "2026-06-18" });
    await db.update(events).set({ rentCents: 8000 }).where(eq(events.id, evt.id)); // $80 per-event rent
    // admission derived = gross cash − seed float − non-admission cash
    const drId = await makeDoorRecord(evt.id, [
      { category: "merchandise", paymentMethod: "cash", amount: 50 },
    ]);
    await updateDoorRecord(db, drId, { grossCash: 350, seedFloat: 0 });
    // admission = 350 − 0 − 50(merch cash) = 300
    const caller = await makePerformer("Cal Caller");
    await createBooking(db, evt.id, { performerId: caller.id, performerType: "caller", pay: 150 });
    // one attendee so dancers = 1 − 1 performer − 1 door = floored 0 → set more
    for (let i = 0; i < 20; i++) await recordAttendance(db, evt.id, { unmatched: true });

    const report = await assembleOrganizerReport(db, "tnc", year);
    const row = report.perDanceRows[0] as Record<string, unknown>;
    // Dance Net = 300 + 50 − 80 − 150 − 0 − 0 = 120
    expect(row.grossGate).toBe(300);
    expect(row.merchandise).toBe(50);
    expect(row.rent).toBe(80);
    expect(row.performerTotal).toBe(150);
    expect(row.danceNet).toBe(120);
    // dancers = 20 attendance − 1 performer(caller) − 1 door = 18
    expect(row.dancers).toBe(18);
    expect(row.caller).toBe("Cal Caller");
    expect((row.performers as unknown[]).length).toBe(1);
  });

  it("TNC report includes same-evening Community Dance events (FR-001)", async () => {
    await makeEvent({ seriesKey: "tnc", eventDate: "2026-06-18" });
    await makeEvent({ seriesKey: "community_dance", eventDate: "2026-06-18" });
    const report = await assembleOrganizerReport(db, "tnc", year);
    const seriesInRows = new Set((report.perDanceRows as { series: string }[]).map((r) => r.series));
    expect(seriesInRows.has("tnc")).toBe(true);
    expect(seriesInRows.has("community_dance")).toBe(true);
  });

  it("per-event dancer count survives the 90-day purge (FR-014)", async () => {
    const evt = await makeEvent({ seriesKey: "tnc", eventDate: "2026-06-18" });
    for (let i = 0; i < 30; i++) await recordAttendance(db, evt.id, { unmatched: true });
    // age attendance rows and purge
    await db.update(attendance).set({ createdAt: sql`now() - interval '100 days'` }).where(eq(attendance.eventId, evt.id));
    await purgeOldAttendance(db);

    const after = await db.query.events.findFirst({ where: eq(events.id, evt.id) });
    expect(after?.attendanceCount).toBe(30); // counter persists
    const report = await assembleOrganizerReport(db, "tnc", year);
    const row = report.perDanceRows[0] as { dancers: number };
    expect(row.dancers).toBe(29); // 30 − 0 performers − 1 door
  });

  it("hides the trend below 12 weeks and shows it at >=12 weeks (FR-011)", async () => {
    // 3 weekly events → <12 weeks
    for (const d of ["2026-06-04", "2026-06-11", "2026-06-18"]) {
      await makeEvent({ seriesKey: "tnc", eventDate: d });
    }
    expect((await assembleOrganizerReport(db, "tnc", year)).trend).toBeNull();

    // add events spanning >12 weeks
    for (let w = 0; w < 16; w++) {
      const d = new Date(Date.UTC(2026, 0, 1) + w * 7 * 86400000).toISOString().slice(0, 10);
      await makeEvent({ seriesKey: "ecd", eventDate: d });
    }
    const t = (await assembleOrganizerReport(db, "ecd", year)).trend;
    expect(t).not.toBeNull();
    expect(t!.danceNet.length).toBeGreaterThanOrEqual(12);
  });

  it("builds a full-year (≥53-week) series report in under 2 seconds (SC-003)", async () => {
    // 53 weekly events across the year, each with a door record + booking
    for (let w = 0; w < 53; w++) {
      const d = new Date(Date.UTC(2026, 0, 1) + w * 7 * 86400000).toISOString().slice(0, 10);
      const evt = await makeEvent({ seriesKey: "tnc", eventDate: d });
      const drId = await makeDoorRecord(evt.id, [
        { category: "merchandise", paymentMethod: "cash", amount: 20 },
      ]);
      await updateDoorRecord(db, drId, { grossCash: 300, seedFloat: 0 });
      const caller = await makePerformer(`Caller ${w}`);
      await createBooking(db, evt.id, { performerId: caller.id, performerType: "caller", pay: 120 });
    }
    const start = performance.now();
    const report = await assembleOrganizerReport(db, "tnc", year);
    const elapsedMs = performance.now() - start;
    expect(report.perDanceRows.length).toBe(53);
    expect(report.trend).not.toBeNull();
    expect(elapsedMs).toBeLessThan(2000);
  });
});
