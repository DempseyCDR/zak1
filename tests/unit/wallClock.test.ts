import { describe, expect, it } from "vitest";
import { formatWallClock } from "@/server/domain/public/wallClock";

// FR-004, SC-002 — a venue-local wall-clock time, formatted with no Date/time-zone math.
describe("formatWallClock", () => {
  it("formats 24h wall-clock strings to 12h with AM/PM", () => {
    expect(formatWallClock("19:30:00")).toBe("7:30 PM");
    expect(formatWallClock("19:30")).toBe("7:30 PM");
    expect(formatWallClock("14:00")).toBe("2:00 PM");
    expect(formatWallClock("00:05")).toBe("12:05 AM");
    expect(formatWallClock("12:00")).toBe("12:00 PM");
    expect(formatWallClock("09:15")).toBe("9:15 AM");
  });

  it("returns null for null/blank/unparseable input", () => {
    expect(formatWallClock(null)).toBeNull();
    expect(formatWallClock(undefined)).toBeNull();
    expect(formatWallClock("")).toBeNull();
    expect(formatWallClock("nope")).toBeNull();
  });

  it("is independent of the process time zone (never constructs a Date)", () => {
    const orig = process.env.TZ;
    try {
      process.env.TZ = "UTC";
      const utc = formatWallClock("19:30:00");
      process.env.TZ = "America/Los_Angeles";
      const la = formatWallClock("19:30:00");
      expect(utc).toBe("7:30 PM");
      expect(la).toBe("7:30 PM");
    } finally {
      process.env.TZ = orig;
    }
  });
});
