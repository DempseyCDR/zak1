// Feature 044 — deterministic date parsing for the two iContact datetime formats and the Payer-sheet
// expiry. All pure, never throw: an unparseable value returns null (research R10). UTC is used so the
// suite is timezone-independent; provider dates are approximate engagement markers, not exact instants.

/**
 * Parse an iContact datetime.
 * - `ymd`: `YYYY-MM-DD HH:MM:SS` (the `setdate` column).
 * - `mdy`: `M-D-YYYY H:MM:SS` (the `ic:lastopendate` / `ic:lastclickdate` columns).
 */
export function parseProviderDate(raw: string | undefined | null, fmt: "ymd" | "mdy"): Date | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  const m =
    fmt === "ymd"
      ? /^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2}):(\d{2})/.exec(s)
      : /^(\d{1,2})-(\d{1,2})-(\d{4})[ T](\d{1,2}):(\d{2}):(\d{2})/.exec(s);
  if (!m) return null;
  const [year, month, day, hh, mm, ss] =
    fmt === "ymd"
      ? [+m[1]!, +m[2]!, +m[3]!, +m[4]!, +m[5]!, +m[6]!]
      : [+m[3]!, +m[1]!, +m[2]!, +m[4]!, +m[5]!, +m[6]!];
  const t = Date.UTC(year, month - 1, day, hh, mm, ss);
  return Number.isNaN(t) ? null : new Date(t);
}

/**
 * Parse a Payer-sheet expiry `M/D/YY` (or `M/D/YYYY`) into a `YYYY-MM-DD` date string. A 2-digit year
 * is interpreted as 20YY. Returns null when blank or unparseable.
 */
export function parseExpiryDate(raw: string | undefined | null): string | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(s);
  if (!m) return null;
  const month = +m[1]!;
  const day = +m[2]!;
  let year = +m[3]!;
  if (year < 100) year += 2000;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Strip a thousands-comma artifact (e.g. `2,022`) and return the integer, or null. */
export function parseYearish(raw: string | undefined | null): number | null {
  const s = (raw ?? "").replace(/,/g, "").trim();
  if (!/^\d+$/.test(s)) return null;
  return parseInt(s, 10);
}
