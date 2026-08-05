import { describe, it, expect } from "vitest";
import { homeWindowStart, HOME_WINDOW_LOOKBACK_DAYS } from "@/server/domain/public/publicSchedule";

// Feature 036 (P6-R3): the /whats-on home window starts two calendar days before today. homeWindowStart
// is the single, testable expression of that lookback (pure, UTC calendar math, rollover-safe).
describe("homeWindowStart", () => {
  it("returns the date two calendar days before the given day", () => {
    expect(homeWindowStart("2026-08-04")).toBe("2026-08-02");
  });

  it("rolls over a month boundary", () => {
    expect(homeWindowStart("2026-03-01")).toBe("2026-02-27");
  });

  it("rolls over a year boundary", () => {
    expect(homeWindowStart("2026-01-01")).toBe("2025-12-30");
  });

  it("uses a two-day lookback by default", () => {
    expect(HOME_WINDOW_LOOKBACK_DAYS).toBe(2);
    expect(homeWindowStart("2026-08-04", HOME_WINDOW_LOOKBACK_DAYS)).toBe("2026-08-02");
  });
});
