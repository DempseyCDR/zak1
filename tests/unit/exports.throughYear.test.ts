import { describe, expect, it } from "vitest";
import { throughYear } from "@/server/domain/exports/throughYear";

describe("throughYear", () => {
  it("returns the calendar year of the given expiry date", () => {
    expect(throughYear("2027-03-14")).toBe(2027);
  });

  it("returns null when no expiry is given", () => {
    expect(throughYear(null)).toBeNull();
  });
});
