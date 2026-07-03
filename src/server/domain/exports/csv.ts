/** RFC 4180-style CSV field escaping: quote on comma/quote/newline, double internal quotes. */
export function toCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Header row + one row per record, values looked up by header key. CRLF line endings (RFC 4180). */
export function rowsToCsv(headers: string[], rows: Record<string, string>[]): string {
  const lines = [headers.map(toCsvField).join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => toCsvField(row[h] ?? "")).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}
