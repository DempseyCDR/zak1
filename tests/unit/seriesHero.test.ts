import { describe, it, expect } from "vitest";
import { seriesHeroSrc } from "@/app/(public)/_components/seriesHero";

// Feature 049 (P7-R5): the per-series → committed hero asset map. Keyed by the stable series key; an
// unmapped/future series returns null so the page renders a clean header (no broken image).
describe("seriesHeroSrc", () => {
  it("maps each known series key to its committed hero asset", () => {
    expect(seriesHeroSrc("tnc")).toBe("/series/contra.webp");
    expect(seriesHeroSrc("ecd")).toBe("/series/ecd.jpg");
    expect(seriesHeroSrc("community_dance")).toBe("/series/community_dance.jpg");
    expect(seriesHeroSrc("general")).toBe("/series/general.jpg");
  });

  it("returns null for an unmapped/unknown series key (clean header)", () => {
    expect(seriesHeroSrc("meeting")).toBeNull(); // reserved asset, but no dance series maps to it
    expect(seriesHeroSrc("some_future_series")).toBeNull();
    expect(seriesHeroSrc("")).toBeNull();
  });
});
