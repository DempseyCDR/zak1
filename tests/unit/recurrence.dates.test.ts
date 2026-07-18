import { describe, expect, it } from "vitest";
import { recurringDates } from "@/server/domain/events/eventService";

// Feature 018 (B26): recurrence date math.
describe("recurringDates", () => {
  it("steps weekly (everyNWeeks=1), inclusive of the last date", () => {
    expect(recurringDates("2026-01-08", 1, "2026-01-29")).toEqual([
      "2026-01-08",
      "2026-01-15",
      "2026-01-22",
      "2026-01-29",
    ]);
  });

  it("steps biweekly (everyNWeeks=2)", () => {
    expect(recurringDates("2026-01-08", 2, "2026-01-29")).toEqual(["2026-01-08", "2026-01-22"]);
  });

  it("returns a single date when first === last", () => {
    expect(recurringDates("2026-01-08", 1, "2026-01-08")).toEqual(["2026-01-08"]);
  });

  it("returns nothing when last is before first", () => {
    expect(recurringDates("2026-02-01", 1, "2026-01-01")).toEqual([]);
  });
});
