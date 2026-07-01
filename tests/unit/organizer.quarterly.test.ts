import { describe, expect, it } from "vitest";
import { quarterlySummary, type QuarterlyRow } from "@/server/domain/organizer/quarterly";

const row = (date: string, danceNet: number, dancers: number): QuarterlyRow => ({
  date,
  dancers,
  gross: danceNet,
  merchandise: 0,
  rent: 0,
  performerTotal: 0,
  ongoing: 0,
  misc: 0,
  danceNet,
  avgTicket: 0,
  fyi: { donations: 0, memberships: 0, futureEvent: 0, giftCards: 0, miscSales: 0 },
});

// FR-010
describe("quarterlySummary", () => {
  it("buckets by calendar quarter with averages, plus YTD and Last Year", () => {
    const rows = [
      row("2026-02-01", 100, 50),
      row("2026-03-01", 200, 60),
      row("2026-05-01", 300, 70),
      row("2025-08-01", 999, 10), // last year
    ];
    const s = quarterlySummary(rows, 2026);
    expect(s.quarters[0]).toMatchObject({ quarter: 1, count: 2, avgDanceNet: 150, avgDancers: 55 });
    expect(s.quarters[1]).toMatchObject({ quarter: 2, count: 1, avgDanceNet: 300 });
    expect(s.quarters[2]!.count).toBe(0);
    expect(s.ytd).toMatchObject({ count: 3, avgDanceNet: 200 });
    expect(s.lastYear).toMatchObject({ count: 1, avgDanceNet: 999 });
  });
});
