import { describe, it, expect } from "vitest";
import {
  fitRows,
  formatCalendarDate,
  resolveStart,
} from "@/server/domain/public/printableCalendar";

// Feature 058 (P7-R15): the pure helpers — the weight-aware one-page cap, the UTC date/weekday formatting, and
// the forgiving ?start boundary (valid YYYY-MM-DD or today, never throws).

describe("fitRows — dynamic, weight-aware one-page cap", () => {
  const unit = () => 1;
  it("takes everything when the total cost is within budget", () => {
    expect(fitRows([1, 2, 3], 5, unit)).toEqual({ rows: [1, 2, 3], truncated: false });
    expect(fitRows([1, 2, 3], 3, unit)).toEqual({ rows: [1, 2, 3], truncated: false });
  });
  it("stops before the item that would exceed the budget and marks truncated", () => {
    expect(fitRows([1, 2, 3, 4, 5], 3, unit)).toEqual({ rows: [1, 2, 3], truncated: true });
  });
  it("weights heavier items so fewer fit (a described row costs more)", () => {
    // budget 5, each item costs 2 → 2+2=4 fits, the third (6) exceeds.
    expect(fitRows([1, 2, 3, 4], 5, () => 2)).toEqual({ rows: [1, 2], truncated: true });
  });
  it("always shows at least one row, even if it alone exceeds the budget", () => {
    expect(fitRows([10, 1], 5, (n) => n)).toEqual({ rows: [10], truncated: true });
  });
  it("empty → no rows, not truncated", () => {
    expect(fitRows([], 5, unit)).toEqual({ rows: [], truncated: false });
  });
});

describe("formatCalendarDate — UTC date + weekday (no off-by-one)", () => {
  it("formats a known date", () => {
    // 2026-11-27 is a Friday.
    expect(formatCalendarDate("2026-11-27")).toEqual({ dateDisplay: "Nov 27", weekday: "Fri" });
  });
  it("does not drift across the day boundary (UTC-parsed)", () => {
    // 2026-01-01 is a Thursday.
    expect(formatCalendarDate("2026-01-01")).toEqual({ dateDisplay: "Jan 1", weekday: "Thu" });
  });
});

describe("resolveStart — the ?start boundary (forgiving)", () => {
  const today = new Date().toISOString().slice(0, 10);
  it("passes a valid YYYY-MM-DD through", () => {
    expect(resolveStart("2026-09-01")).toBe("2026-09-01");
  });
  it("falls back to today for absent / malformed / non-date values (never throws)", () => {
    for (const raw of [
      undefined,
      "",
      "nope",
      "2026-13-40",
      "2026/09/01",
      "09-01-2026",
      "2026-9-1",
    ]) {
      expect(resolveStart(raw)).toBe(today);
    }
  });
});
