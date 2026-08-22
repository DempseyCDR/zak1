import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { contrastRatio, AA_NORMAL, AA_LARGE } from "@/app/lib/contrast";
import { EVENT_TYPE_COLORS } from "@/app/tokens";
import type { EventType } from "@/app/tokens";

// Feature 045 (P7-R1, US3): the event-type color coding (FR-007 / SC-005) is single-source and typed.
const GLOBALS = fileURLToPath(new URL("../../src/app/globals.css", import.meta.url));

function readRootHexTokens(): Record<string, string> {
  const root = /:root\s*\{([\s\S]*?)\}/.exec(readFileSync(GLOBALS, "utf8"));
  const out: Record<string, string> = {};
  for (const m of root![1]!.matchAll(/(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{3,6})\s*;/g))
    out[m[1]!] = m[2]!;
  return out;
}

const TYPES: EventType[] = ["contra", "english", "special", "assembly", "meeting"];
const tok = readRootHexTokens();

describe("event-type color coding (US3)", () => {
  it("maps all five types, each to its --type-* variable", () => {
    expect(Object.keys(EVENT_TYPE_COLORS).sort()).toEqual([...TYPES].sort());
    for (const type of TYPES) {
      expect(EVENT_TYPE_COLORS[type]).toBe(`var(--type-${type})`);
      expect(tok[`--type-${type}`]).toBeDefined(); // single source: the hex exists in globals.css
    }
  });

  it("every type color is legible as an accent with the text color (UI ≥3:1)", () => {
    for (const type of TYPES) {
      expect(contrastRatio(tok["--text"]!, tok[`--type-${type}`]!)).toBeGreaterThanOrEqual(
        AA_LARGE,
      );
    }
  });

  it("documents that --type-meeting is accent-only (below AA-normal with text)", () => {
    // research R3: meeting #9b84ce with charcoal is 3.48:1 — fine as an accent/badge, not behind body text.
    expect(contrastRatio(tok["--text"]!, tok["--type-meeting"]!)).toBeLessThan(AA_NORMAL);
  });
});
