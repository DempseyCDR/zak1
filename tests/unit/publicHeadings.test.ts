import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

// Feature 045 (P7-R1, US2): heading discipline (FR-006 / SC-003) — each public page has exactly ONE <h1>.
// The pages are async server components (not jsdom-renderable), so this guards the source directly.
const PUBLIC = (p: string) =>
  fileURLToPath(new URL(`../../src/app/(public)/${p}`, import.meta.url));

const pages = [
  "whats-on/page.tsx",
  "what-was-on/page.tsx",
  "whats-on/[eventId]/page.tsx",
  "join/page.tsx",
];

describe("public pages — exactly one <h1> each (US2)", () => {
  for (const page of pages) {
    it(`${page} declares a single <h1>`, () => {
      const src = readFileSync(PUBLIC(page), "utf8");
      const count = (src.match(/<h1[\s>]/g) ?? []).length;
      expect(count).toBe(1);
    });
  }
});
