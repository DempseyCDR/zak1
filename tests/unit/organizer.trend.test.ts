import { describe, expect, it } from "vitest";
import { buildTrend, type TrendPoint } from "@/server/domain/organizer/trend";

function weekly(n: number, startISO = "2026-01-01"): TrendPoint[] {
  const start = new Date(startISO).getTime();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(start + i * 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    return { date: d, danceNet: i % 2 === 0 ? 100 : -50, dancers: 40 + i, caller: "C", band: "B" };
  });
}

// FR-011/012
describe("buildTrend", () => {
  it("returns null below 12 weeks", () => {
    expect(buildTrend(weekly(8))).toBeNull();
  });

  it("builds two panels + 4-event rolling average at ≥12 weeks", () => {
    const t = buildTrend(weekly(20));
    expect(t).not.toBeNull();
    expect(t!.danceNet).toHaveLength(20);
    expect(t!.attendance).toHaveLength(20);
    expect(t!.danceNetTrend).toHaveLength(20);
    expect(t!.danceNet[0]!.negative).toBe(false); // first point +100
    expect(t!.danceNet[1]!.negative).toBe(true); // second −50
  });

  it("caps the window at the most recent 53 weeks", () => {
    const t = buildTrend(weekly(80));
    expect(t).not.toBeNull();
    expect(t!.weeks).toBe(53);
    expect(t!.danceNet.length).toBeLessThanOrEqual(53);
  });
});
