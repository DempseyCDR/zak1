import { parse } from "csv-parse/sync";
import { z } from "zod";
import type { MemberRow } from "./loadPlan";

// Feature 044 — parse the workbook's Member sheet (exported to CSV). Authoritative for identity
// (name/pronouns/phone), volunteer eligibility, and the payer link. Button Report / iContact Report
// sheets are NOT parsed.
const REQUIRED_COLUMNS = [
  "First Name",
  "Last Name",
  "Pronouns",
  "Volunteer",
  "Payer",
  "Email",
  "Phone",
];

const emailSchema = z.string().email();

function blankToNull(v: string | undefined): string | null {
  const s = (v ?? "").trim();
  return s.length > 0 ? s : null;
}

export function parseMemberSheet(content: string): MemberRow[] {
  const records = parse(content, {
    columns: true,
    bom: true,
    trim: true,
    skip_empty_lines: true,
    relax_column_count: true,
  }) as Record<string, string>[];

  if (records.length > 0) {
    const header = Object.keys(records[0]!);
    const missing = REQUIRED_COLUMNS.filter((c) => !header.includes(c));
    if (missing.length > 0) {
      throw new Error(`Member sheet CSV missing column(s): ${missing.join(", ")}`);
    }
  }

  const rows: MemberRow[] = [];
  for (const r of records) {
    const firstName = (r["First Name"] ?? "").trim();
    const emailRaw = blankToNull(r.Email);
    let email: string | null = null;
    if (emailRaw) {
      const parsed = emailSchema.safeParse(emailRaw.toLowerCase());
      if (!parsed.success) throw new Error(`Member sheet: invalid email "${emailRaw}"`);
      email = parsed.data;
    }
    // A wholly blank row (no name, no email) is skipped.
    if (!firstName && !email && !blankToNull(r["Last Name"])) continue;
    rows.push({
      firstName,
      lastName: blankToNull(r["Last Name"]),
      buttonName: blankToNull(r["Button Name"]),
      pronouns: blankToNull(r.Pronouns),
      volunteer: (r.Volunteer ?? "").trim().toLowerCase() === "yes",
      payerKey: blankToNull(r.Payer),
      email,
      phone: blankToNull(r.Phone),
    });
  }
  return rows;
}
