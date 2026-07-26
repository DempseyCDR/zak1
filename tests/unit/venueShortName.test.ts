import { describe, expect, it } from "vitest";
import { venueShortNameDefault } from "@/server/domain/venues/venueService";

// Feature 020 US5 (FR-024): the default venue short name = uppercased initials of each word.
describe("venueShortNameDefault", () => {
  it("takes the uppercased first letter of each word", () => {
    expect(venueShortNameDefault("German House")).toBe("GH");
    expect(venueShortNameDefault("First Unitarian Church")).toBe("FUC");
    expect(venueShortNameDefault("The Harmony")).toBe("TH");
  });

  it("collapses extra whitespace and ignores empty tokens", () => {
    expect(venueShortNameDefault("  The   Rose  Room ")).toBe("TRR");
  });

  it("returns empty string for an empty/whitespace name", () => {
    expect(venueShortNameDefault("")).toBe("");
    expect(venueShortNameDefault("   ")).toBe("");
  });
});
