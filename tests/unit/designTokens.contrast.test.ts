import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { contrastRatio, AA_NORMAL, AA_LARGE } from "@/app/lib/contrast";

// Feature 045 (P7-R1) — the accessibility floor (FR-005 / SC-002) is enforced against the SHIPPED token
// values: parse `globals.css` :root and assert WCAG AA on every text/UI pairing (research R3). This fails
// first if `--link` is left at the audit's #b96131 (3.82:1 on cream) — the point of the test.

const GLOBALS = fileURLToPath(new URL("../../src/app/globals.css", import.meta.url));

/** Extract `--name: #hex` custom properties from the `:root { … }` block. */
function readRootHexTokens(): Record<string, string> {
  const css = readFileSync(GLOBALS, "utf8");
  const root = /:root\s*\{([\s\S]*?)\}/.exec(css);
  if (!root) throw new Error("no :root block in globals.css");
  const out: Record<string, string> = {};
  for (const m of root[1]!.matchAll(/(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{3,6})\s*;/g)) {
    out[m[1]!] = m[2]!;
  }
  return out;
}

const tok = readRootHexTokens();
const need = (name: string): string => {
  const v = tok[name];
  if (!v) throw new Error(`missing color token ${name} in globals.css :root`);
  return v;
};

describe("design tokens — WCAG AA contrast (research R3)", () => {
  it("body and muted text on the ground pass AA-normal", () => {
    expect(contrastRatio(need("--text"), need("--ground"))).toBeGreaterThanOrEqual(AA_NORMAL);
    expect(contrastRatio(need("--text-muted"), need("--ground"))).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it("the resting link on the ground passes AA-normal (NOT the audit's failing terracotta)", () => {
    expect(contrastRatio(need("--link"), need("--ground"))).toBeGreaterThanOrEqual(AA_NORMAL);
    expect(contrastRatio(need("--link-hover"), need("--ground"))).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it("links/text on the steel-blue band pass AA (the peach-on-blue defect is designed out)", () => {
    expect(contrastRatio(need("--link-on-dark"), need("--band"))).toBeGreaterThanOrEqual(AA_NORMAL);
    expect(contrastRatio(need("--link-on-dark"), need("--band-hover"))).toBeGreaterThanOrEqual(
      AA_NORMAL,
    );
  });

  it("steel used as heading/accent text on the ground passes AA", () => {
    expect(contrastRatio(need("--band"), need("--ground"))).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it("every event-type color is legible as an accent with the text color (UI threshold)", () => {
    for (const type of ["contra", "english", "special", "assembly", "meeting"]) {
      expect(contrastRatio(need("--text"), need(`--type-${type}`))).toBeGreaterThanOrEqual(
        AA_LARGE,
      );
    }
  });
});
