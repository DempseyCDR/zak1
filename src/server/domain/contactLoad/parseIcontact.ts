import { parse } from "csv-parse/sync";
import { z } from "zod";
import type { IcontactRow } from "./loadPlan";
import { parseProviderDate, parseYearish } from "./dates";

// Feature 044 — parse the iContact CSV export into validated rows (research R2). Consumes only the mapped
// columns; everything else (prefix, address, business, userid, eventregistration, performer, memberthrough…)
// is ignored.
const REQUIRED_COLUMNS = [
  "email",
  "fname",
  "lname",
  "phone",
  "setdate",
  "contra",
  "english",
  "openband",
  "specialevents",
  "janeaustenball",
  "ic:lastopendate",
  "ic:lastclickdate",
];

const emailSchema = z.string().email();

function blankToNull(v: string | undefined): string | null {
  const s = (v ?? "").trim();
  return s.length > 0 ? s : null;
}

/** A list flag is subscribed only when the value is exactly `1` (blank and `-1` are both "not"). */
function flag(v: string | undefined): boolean {
  return (v ?? "").trim() === "1";
}

/** Jane Austen Ball column holds a year (subscribed) or is blank/`-1`/`0` (not). */
function jabFlag(v: string | undefined): boolean {
  return parseYearish(v) !== null;
}

export function parseIcontact(content: string): IcontactRow[] {
  const records = parse(content, {
    // iContact wraps its header names in brackets (`[email]`, `[janeaustenball]`); strip them so the
    // column keys are bare. Plain headers pass through unchanged.
    columns: (header: string[]) => header.map((h) => h.trim().replace(/^\[(.*)\]$/, "$1")),
    bom: true,
    trim: true,
    skip_empty_lines: true,
    relax_column_count: true,
  }) as Record<string, string>[];

  if (records.length > 0) {
    const header = Object.keys(records[0]!);
    const missing = REQUIRED_COLUMNS.filter((c) => !header.includes(c));
    if (missing.length > 0) {
      throw new Error(`iContact CSV missing column(s): ${missing.join(", ")}`);
    }
  }

  const rows: IcontactRow[] = [];
  for (const r of records) {
    const emailRaw = (r.email ?? "").trim();
    if (!emailRaw) continue; // an iContact row keyed by nothing cannot be loaded
    const parsed = emailSchema.safeParse(emailRaw.toLowerCase());
    if (!parsed.success) {
      throw new Error(`iContact CSV: invalid email "${emailRaw}"`);
    }
    rows.push({
      email: parsed.data,
      firstName: blankToNull(r.fname),
      lastName: blankToNull(r.lname),
      phone: blankToNull(r.phone),
      providerSetDate: parseProviderDate(r.setdate, "ymd"),
      providerLastOpen: parseProviderDate(r["ic:lastopendate"], "mdy"),
      providerLastClick: parseProviderDate(r["ic:lastclickdate"], "mdy"),
      flags: {
        contra: flag(r.contra),
        english: flag(r.english),
        openband: flag(r.openband),
        specialevents: flag(r.specialevents),
        janeAustenBall: jabFlag(r.janeaustenball),
      },
    });
  }
  return rows;
}
