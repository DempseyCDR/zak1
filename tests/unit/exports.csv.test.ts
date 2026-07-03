import { describe, expect, it } from "vitest";
import { rowsToCsv, toCsvField } from "@/server/domain/exports/csv";

describe("toCsvField", () => {
  it("leaves a plain field unquoted", () => {
    expect(toCsvField("Grace Hopper")).toBe("Grace Hopper");
  });

  it("quotes a field containing a comma", () => {
    expect(toCsvField("Hopper, Grace")).toBe('"Hopper, Grace"');
  });

  it("quotes a field containing a quote and doubles internal quotes", () => {
    expect(toCsvField('Say "hi"')).toBe('"Say ""hi"""');
  });

  it("quotes a field containing a newline", () => {
    expect(toCsvField("line1\nline2")).toBe('"line1\nline2"');
  });
});

describe("rowsToCsv", () => {
  it("builds a header row plus one row per record, CRLF-terminated", () => {
    const csv = rowsToCsv(
      ["email", "first_name"],
      [{ email: "grace@example.com", first_name: "Grace" }],
    );
    expect(csv).toBe("email,first_name\r\ngrace@example.com,Grace\r\n");
  });

  it("escapes values that need quoting within a row", () => {
    const csv = rowsToCsv(["email", "last_name"], [{ email: "a@b.com", last_name: "Smith, Jr." }]);
    expect(csv).toBe('email,last_name\r\na@b.com,"Smith, Jr."\r\n');
  });
});
