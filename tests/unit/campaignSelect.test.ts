import { describe, it, expect } from "vitest";
import { isCampaignActive, selectShownCampaign } from "@/server/domain/campaigns/campaignService";
import { campaignSchema } from "@/server/validation/campaign";
import type { CampaignRow } from "@/server/db/schema";

// Feature 057 (P7-R14): the date-window boundary (FR-006) and the QUEUE selector (FR-014 / SC-009) are PURE and
// tested off-DB, test-first for the full selector (Constitution I) — earliest end date wins, ties by earliest
// start then created_at, with the handoff. Plus the http(s)/internal-path allowlist on the payload.

/** Minimal CampaignRow factory for the pure functions (only the selection fields matter). */
function row(p: {
  id: string;
  startDate: string;
  endDate: string;
  createdAt?: string;
}): CampaignRow {
  return {
    id: p.id,
    heading: "H",
    blurb: "B",
    imageUrl: null,
    imageAlt: null,
    ctaLabel: "Go",
    ctaUrl: "/x",
    startDate: p.startDate,
    endDate: p.endDate,
    createdAt: new Date(p.createdAt ?? "2026-01-01T00:00:00Z"),
    updatedAt: new Date(p.createdAt ?? "2026-01-01T00:00:00Z"),
  };
}

describe("isCampaignActive — date-window boundary (FR-006)", () => {
  const r = { startDate: "2026-11-01", endDate: "2026-11-30" };
  it("is active on the start and end dates (inclusive)", () => {
    expect(isCampaignActive(r, "2026-11-01")).toBe(true);
    expect(isCampaignActive(r, "2026-11-30")).toBe(true);
    expect(isCampaignActive(r, "2026-11-15")).toBe(true);
  });
  it("is inactive the day before the start and the day after the end", () => {
    expect(isCampaignActive(r, "2026-10-31")).toBe(false);
    expect(isCampaignActive(r, "2026-12-01")).toBe(false);
  });
});

describe("selectShownCampaign — the queue (FR-014 / SC-009)", () => {
  it("returns the single active row, and null when none active", () => {
    const a = row({ id: "a", startDate: "2026-11-01", endDate: "2026-11-30" });
    expect(selectShownCampaign([a], "2026-11-10")?.id).toBe("a");
    expect(selectShownCampaign([a], "2026-10-01")).toBeNull();
    expect(selectShownCampaign([], "2026-11-10")).toBeNull();
  });

  it("among several active rows shows the one that EXPIRES FIRST (earliest end date)", () => {
    const a = row({ id: "a", startDate: "2026-11-01", endDate: "2026-11-30" });
    const b = row({ id: "b", startDate: "2026-11-05", endDate: "2026-11-15" }); // ends sooner
    expect(selectShownCampaign([a, b], "2026-11-10")?.id).toBe("b");
  });

  it("breaks an end-date tie by earliest start date, then created_at", () => {
    const sameEnd = "2026-11-20";
    const later = row({ id: "later", startDate: "2026-11-10", endDate: sameEnd });
    const earlier = row({ id: "earlier", startDate: "2026-11-01", endDate: sameEnd });
    expect(selectShownCampaign([later, earlier], "2026-11-15")?.id).toBe("earlier");

    const c1 = row({
      id: "c1",
      startDate: "2026-11-01",
      endDate: sameEnd,
      createdAt: "2026-01-01T00:00:00Z",
    });
    const c2 = row({
      id: "c2",
      startDate: "2026-11-01",
      endDate: sameEnd,
      createdAt: "2026-02-01T00:00:00Z",
    });
    expect(selectShownCampaign([c2, c1], "2026-11-15")?.id).toBe("c1");
  });

  it("excludes rows outside their window", () => {
    const past = row({ id: "past", startDate: "2026-10-01", endDate: "2026-10-31" });
    const future = row({ id: "future", startDate: "2026-12-01", endDate: "2026-12-31" });
    const active = row({ id: "active", startDate: "2026-11-01", endDate: "2026-11-30" });
    expect(selectShownCampaign([past, future, active], "2026-11-10")?.id).toBe("active");
  });

  it("hands off: after the shown row expires, the next-soonest-expiring active row shows", () => {
    const b = row({ id: "b", startDate: "2026-11-05", endDate: "2026-11-15" });
    const a = row({ id: "a", startDate: "2026-11-01", endDate: "2026-11-30" });
    expect(selectShownCampaign([a, b], "2026-11-10")?.id).toBe("b"); // b expires first
    expect(selectShownCampaign([a, b], "2026-11-16")?.id).toBe("a"); // b gone → a shows
  });

  // US3 (T015): the nested-window edge case — a short campaign inside a longer one takes precedence while
  // active (it expires first), and the longer one shows on the days before/after; neither is starved.
  it("nested window: the short inner campaign shows while active; the long one before and after", () => {
    const long = row({ id: "long", startDate: "2026-11-01", endDate: "2026-11-30" });
    const short = row({ id: "short", startDate: "2026-11-10", endDate: "2026-11-15" });
    expect(selectShownCampaign([long, short], "2026-11-05")?.id).toBe("long"); // before the inner window
    expect(selectShownCampaign([long, short], "2026-11-12")?.id).toBe("short"); // inner active → precedence
    expect(selectShownCampaign([long, short], "2026-11-20")?.id).toBe("long"); // after → long resumes
  });
});

describe("campaignSchema", () => {
  const base = {
    heading: "Golden Weekend",
    blurb: "Three days of dancing",
    cta: { label: "Learn more", url: "/golden-weekend" },
    startDate: "2026-11-01",
    endDate: "2026-11-30",
  };

  it("accepts a valid payload (defaults image to null)", () => {
    const parsed = campaignSchema.parse(base);
    expect(parsed.image).toBeNull();
    expect(parsed.cta.url).toBe("/golden-weekend");
  });

  it("requires heading and blurb", () => {
    expect(campaignSchema.safeParse({ ...base, heading: "" }).success).toBe(false);
    expect(campaignSchema.safeParse({ ...base, blurb: "  " }).success).toBe(false);
  });

  it("image requires alt and an http(s) url; rejects javascript:/data:/relative", () => {
    expect(
      campaignSchema.safeParse({ ...base, image: { url: "https://ex.org/a.jpg", alt: "Dancers" } })
        .success,
    ).toBe(true);
    expect(
      campaignSchema.safeParse({ ...base, image: { url: "https://ex.org/a.jpg", alt: "" } })
        .success,
    ).toBe(false);
    for (const url of ["javascript:alert(1)", "data:image/png,x", "/local.jpg"]) {
      expect(campaignSchema.safeParse({ ...base, image: { url, alt: "x" } }).success).toBe(false);
    }
  });

  it("cta.url accepts an internal path and https:, rejects javascript: and protocol-relative", () => {
    expect(campaignSchema.safeParse({ ...base, cta: { label: "x", url: "/page" } }).success).toBe(
      true,
    );
    expect(
      campaignSchema.safeParse({ ...base, cta: { label: "x", url: "https://ex.org" } }).success,
    ).toBe(true);
    expect(
      campaignSchema.safeParse({ ...base, cta: { label: "x", url: "javascript:x" } }).success,
    ).toBe(false);
    expect(
      campaignSchema.safeParse({ ...base, cta: { label: "x", url: "//evil.example" } }).success,
    ).toBe(false);
  });

  it("enforces endDate >= startDate and YYYY-MM-DD", () => {
    expect(campaignSchema.safeParse({ ...base, endDate: "2026-10-31" }).success).toBe(false);
    expect(campaignSchema.safeParse({ ...base, startDate: "11/01/2026" }).success).toBe(false);
    expect(campaignSchema.safeParse({ ...base, startDate: "2026-13-01" }).success).toBe(false);
  });
});
