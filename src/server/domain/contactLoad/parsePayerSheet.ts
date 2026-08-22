import { parse } from "csv-parse/sync";
import { z } from "zod";
import type { PayerInput } from "./loadPlan";
import { membershipLevelEnum } from "@/server/db/schema";
import { parseExpiryDate } from "./dates";

// Feature 044 — parse the workbook's Payer sheet (exported to CSV). Authoritative for memberships:
// key, payer name, expiry, and level. Amount/Method/Date are ignored (research R7).
const REQUIRED_COLUMNS = ["ID", "Payer Name", "Expires", "Level"];

const levelSchema = z.enum(membershipLevelEnum.enumValues);

export function parsePayerSheet(content: string): PayerInput[] {
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
      throw new Error(`Payer sheet CSV missing column(s): ${missing.join(", ")}`);
    }
  }

  const rows: PayerInput[] = [];
  for (const r of records) {
    const key = (r.ID ?? "").trim();
    if (!key) continue;
    const levelRaw = (r.Level ?? "").trim().toLowerCase();
    const level = levelSchema.safeParse(levelRaw);
    if (!level.success) {
      throw new Error(`Payer sheet: unknown Level "${r.Level}" for payer "${key}"`);
    }
    rows.push({
      key,
      payerName: (r["Payer Name"] ?? "").trim(),
      expires: parseExpiryDate(r.Expires),
      level: level.data,
    });
  }
  return rows;
}
