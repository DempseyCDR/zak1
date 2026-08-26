import { describe, it, expect } from "vitest";
import { isAnnouncementActive } from "@/server/domain/announcements/announcementService";
import { announcementPostSchema } from "@/server/validation/announcement";

// Feature 056 (P7-R13): the duration boundary (SC-008) is a PURE function, testable off-DB, and the post
// payload's http(s)-only link allowlist. No banner scheduler exists — active is derived on read.

const HOUR = 60 * 60 * 1000;

describe("isAnnouncementActive — duration boundary (SC-008)", () => {
  const postedAt = new Date("2026-08-26T18:00:00Z");
  const base = { postedAt, durationHours: 24, clearedAt: null as Date | null };

  it("is active just BEFORE posted_at + duration_hours", () => {
    const justBefore = new Date(postedAt.getTime() + 24 * HOUR - 1000);
    expect(isAnnouncementActive(base, justBefore)).toBe(true);
  });

  it("is inactive AT/just after posted_at + duration_hours", () => {
    const atExpiry = new Date(postedAt.getTime() + 24 * HOUR);
    const justAfter = new Date(postedAt.getTime() + 24 * HOUR + 1000);
    expect(isAnnouncementActive(base, atExpiry)).toBe(false);
    expect(isAnnouncementActive(base, justAfter)).toBe(false);
  });

  it("is inactive when cleared, even inside the window", () => {
    const inside = new Date(postedAt.getTime() + HOUR);
    expect(isAnnouncementActive({ ...base, clearedAt: new Date(postedAt) }, inside)).toBe(false);
  });

  it("honours a custom duration (1 hour)", () => {
    const oneHour = { ...base, durationHours: 1 };
    expect(isAnnouncementActive(oneHour, new Date(postedAt.getTime() + 30 * 60 * 1000))).toBe(true);
    expect(isAnnouncementActive(oneHour, new Date(postedAt.getTime() + 2 * HOUR))).toBe(false);
  });
});

describe("announcementPostSchema", () => {
  it("requires non-empty text", () => {
    expect(announcementPostSchema.safeParse({ text: "" }).success).toBe(false);
    expect(announcementPostSchema.safeParse({ text: "   " }).success).toBe(false);
  });

  it("defaults level=info, durationHours=24, link=null", () => {
    const parsed = announcementPostSchema.parse({ text: "Snow day" });
    expect(parsed.level).toBe("info");
    expect(parsed.durationHours).toBe(24);
    expect(parsed.link).toBeNull();
  });

  it("accepts level=urgent and rejects an unknown level", () => {
    expect(announcementPostSchema.safeParse({ text: "x", level: "urgent" }).success).toBe(true);
    expect(announcementPostSchema.safeParse({ text: "x", level: "warning" }).success).toBe(false);
  });

  it("enforces durationHours bounds (1..720, integer)", () => {
    expect(announcementPostSchema.safeParse({ text: "x", durationHours: 0 }).success).toBe(false);
    expect(announcementPostSchema.safeParse({ text: "x", durationHours: 721 }).success).toBe(false);
    expect(announcementPostSchema.safeParse({ text: "x", durationHours: 1.5 }).success).toBe(false);
    expect(announcementPostSchema.safeParse({ text: "x", durationHours: 720 }).success).toBe(true);
  });

  it("accepts an https link and rejects javascript:/data:/relative URLs", () => {
    expect(
      announcementPostSchema.safeParse({
        text: "x",
        link: { label: "More", url: "https://cdrochester.org/weather" },
      }).success,
    ).toBe(true);
    for (const url of ["javascript:alert(1)", "data:text/html,hi", "/relative/path"]) {
      expect(
        announcementPostSchema.safeParse({ text: "x", link: { label: "More", url } }).success,
      ).toBe(false);
    }
  });

  it("rejects a link missing its label", () => {
    expect(
      announcementPostSchema.safeParse({
        text: "x",
        link: { label: "", url: "https://example.org" },
      }).success,
    ).toBe(false);
  });
});
