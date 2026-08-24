import { describe, it, expect } from "vitest";
import {
  promoLinkSchema,
  promoLinksSchema,
  stylesSchema,
  isStyleTag,
} from "@/server/domain/public/promoLinks";

// Feature 053 (P7-R9): the write-boundary security test. A promo link renders as a public <a href>, so the
// URL scheme is allowlisted to http(s); every other scheme (and malformed/relative URLs) is rejected before
// it can be stored. Style tags are a closed set.
describe("promoLinkSchema — URL scheme allowlist", () => {
  it("accepts http and https", () => {
    expect(
      promoLinkSchema.safeParse({ type: "website", url: "https://cdrochester.org" }).success,
    ).toBe(true);
    expect(
      promoLinkSchema.safeParse({ type: "bandcamp", url: "http://example.bandcamp.com" }).success,
    ).toBe(true);
  });

  it("rejects javascript:, data:, mailto:, ftp:, relative, and malformed URLs", () => {
    for (const url of [
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "mailto:info@cdrochester.org",
      "ftp://example.com/file",
      "/relative/path",
      "not a url",
      "",
    ]) {
      expect(promoLinkSchema.safeParse({ type: "website", url }).success).toBe(false);
    }
  });

  it("rejects a type outside the enum", () => {
    expect(promoLinkSchema.safeParse({ type: "tiktok", url: "https://tiktok.com/x" }).success).toBe(
      false,
    );
  });

  it("promoLinksSchema defaults to [] and validates each element", () => {
    expect(promoLinksSchema.parse(undefined)).toEqual([]);
    expect(
      promoLinksSchema.safeParse([
        { type: "website", url: "https://a.example" },
        { type: "instagram", url: "javascript:void(0)" },
      ]).success,
    ).toBe(false);
  });
});

describe("stylesSchema — closed style set", () => {
  it("accepts known styles and defaults to []", () => {
    expect(stylesSchema.parse(undefined)).toEqual([]);
    expect(stylesSchema.safeParse(["contra", "english", "community"]).success).toBe(true);
  });

  it("rejects an unknown style", () => {
    expect(stylesSchema.safeParse(["contra", "salsa"]).success).toBe(false);
  });

  it("isStyleTag guards a query param", () => {
    expect(isStyleTag("contra")).toBe(true);
    expect(isStyleTag("salsa")).toBe(false);
  });
});
