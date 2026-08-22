import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

// Feature 047 (P7-R3): the home moved into the (public) group with one <h1>, and the old root staff stub
// is removed (FR-009). The home is an async server component (reads the schedule), so this guards the
// source; full-page behavior is browser-verified (quickstart).
const rel = (p: string) => fileURLToPath(new URL(`../../src/app/${p}`, import.meta.url));

describe("public home structure (P7-R3)", () => {
  it("the home lives in the (public) group and declares exactly one <h1>", () => {
    const src = readFileSync(rel("(public)/page.tsx"), "utf8");
    expect((src.match(/<h1[\s>]/g) ?? []).length).toBe(1);
  });

  it("the old root staff stub (app/page.tsx) is removed", () => {
    expect(existsSync(rel("page.tsx"))).toBe(false);
  });
});
