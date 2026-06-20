import { describe, expect, it } from "vitest";
import { classifyMembership, isListMember } from "@/server/domain/membership/classify";

const base = { longLapseCycles: 3, cycleDefinition: "1 year", now: new Date("2026-06-19T12:00:00Z") };

// FR-007, FR-008
describe("classifyMembership", () => {
  it("returns 'never' when there is no membership", () => {
    expect(classifyMembership({ ...base, mostRecentExpiry: null })).toBe("never");
  });

  it("returns 'current' when expiry is today or in the future", () => {
    expect(classifyMembership({ ...base, mostRecentExpiry: "2026-06-19" })).toBe("current");
    expect(classifyMembership({ ...base, mostRecentExpiry: "2027-01-01" })).toBe("current");
  });

  it("returns 'lapsed' when expired within long_lapse_cycles cycles", () => {
    // expired 2025-12-31, within 3 years of 2026-06-19
    expect(classifyMembership({ ...base, mostRecentExpiry: "2025-12-31" })).toBe("lapsed");
    // edge: exactly 3 years before now is still lapsed
    expect(classifyMembership({ ...base, mostRecentExpiry: "2023-06-19" })).toBe("lapsed");
  });

  it("returns 'long_lapsed' when expired beyond the window", () => {
    // expired 2022-01-01, > 3 years before 2026-06-19
    expect(classifyMembership({ ...base, mostRecentExpiry: "2022-01-01" })).toBe("long_lapsed");
  });

  it("respects a non-default cycle definition", () => {
    // 1 cycle of 6 months -> boundary 6 months after expiry
    const cfg = { now: new Date("2026-06-19T00:00:00Z"), longLapseCycles: 1, cycleDefinition: "6 months" };
    expect(classifyMembership({ ...cfg, mostRecentExpiry: "2026-03-01" })).toBe("lapsed");
    expect(classifyMembership({ ...cfg, mostRecentExpiry: "2025-01-01" })).toBe("long_lapsed");
  });

  it("isListMember excludes only 'never'", () => {
    expect(isListMember("never")).toBe(false);
    expect(isListMember("current")).toBe(true);
    expect(isListMember("long_lapsed")).toBe(true);
  });
});
