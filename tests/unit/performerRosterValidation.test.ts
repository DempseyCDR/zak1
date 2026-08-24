import { describe, it, expect } from "vitest";
import { performerPatchSchema } from "@/server/validation/performers";
import { bandPatchSchema } from "@/server/validation/bands";

// Feature 053 (P7-R9): the performer/band write schemas accept the new roster fields and reject an unsafe
// promo-link scheme at the boundary (a `javascript:` URL can never be stored).
describe("performerPatchSchema — roster fields", () => {
  it("accepts isPublic / isCaller / styles / valid links", () => {
    const r = performerPatchSchema.safeParse({
      isPublic: true,
      isCaller: true,
      styles: ["contra"],
      links: [{ type: "website", url: "https://caller.example" }],
    });
    expect(r.success).toBe(true);
  });

  it("rejects a link with a non-http(s) scheme", () => {
    const r = performerPatchSchema.safeParse({
      links: [{ type: "website", url: "javascript:alert(1)" }],
    });
    expect(r.success).toBe(false);
  });

  it("rejects an unknown style", () => {
    expect(performerPatchSchema.safeParse({ styles: ["salsa"] }).success).toBe(false);
  });
});

describe("bandPatchSchema — roster fields + member instrument", () => {
  it("accepts isPublic / styles / links and a member instrument", () => {
    const r = bandPatchSchema.safeParse({
      isPublic: true,
      styles: ["english"],
      links: [{ type: "bandcamp", url: "https://band.bandcamp.com" }],
      members: [
        { performerId: "11111111-1111-1111-1111-111111111111", isLead: true, instrument: "fiddle" },
      ],
    });
    expect(r.success).toBe(true);
  });

  it("rejects an unsafe link scheme", () => {
    const r = bandPatchSchema.safeParse({ links: [{ type: "other", url: "data:text/html,x" }] });
    expect(r.success).toBe(false);
  });
});
