import { describe, expect, it } from "vitest";
import { normalizeName, uniqueSet } from "@/server/domain/contacts/normalize";

describe("normalizeName", () => {
  it("lowercases and collapses whitespace", () => {
    expect(normalizeName("  Ada   LOVELACE ")).toBe("ada lovelace");
  });
});

describe("uniqueSet", () => {
  it("de-duplicates preserving first-seen order", () => {
    expect(uniqueSet(["personal", "booking", "personal"])).toEqual(["personal", "booking"]);
  });
});
