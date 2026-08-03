// Feature 032 (P5-R6): pure phone helpers, beside the 012 name normalizer. No I/O — safe to import
// server-side (the contact-write paths + the backfill parity test) and client-side (display, e.g. P5-R7).

/**
 * Canonicalize a phone for storage: E.164-style, assuming US (`+1`) when no country code is given.
 * NEVER throws or rejects — an input that can't be parsed as a clean number (wrong length, letters, or an
 * extension) is returned **as entered** (trimmed) so no information is lost. Idempotent: a canonical value
 * (`+1XXXXXXXXXX` or `+<cc>…`) normalizes to itself.
 *
 * Rule (kept simple enough to reproduce identically in the 0030 backfill SQL):
 * - 10 digits (no country code) → `+1` + those 10 digits.
 * - 11 digits leading with `1` (with or without a `+`) → `+1` + the last 10 digits.
 * - an existing `+`-prefixed number with ≥ 11 digits (non-US E.164) → kept (`+` + its digits).
 * - anything else → the original trimmed input (raw).
 */
export function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (!hasPlus && digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+1${digits.slice(1)}`;
  if (hasPlus && digits.length >= 11) return `+${digits}`;
  return trimmed; // unparseable → raw (never rejected — FR-003)
}

/**
 * Display a stored phone in a standard dashed form. NEVER throws.
 * - US canonical (`+1` + 10 digits) → `NPA-NXX-XXXX` (e.g. `585-555-1234`).
 * - anything else (non-US E.164, which keeps its `+<cc>`, or a raw/unparseable value) → returned as stored.
 *   (Per-country grouping beyond keeping the country code is out of scope — best-effort.)
 */
export function formatPhone(stored: string): string {
  const s = stored.trim();
  if (!s) return "";
  const us = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(s);
  if (us) return `${us[1]}-${us[2]}-${us[3]}`;
  return s;
}
