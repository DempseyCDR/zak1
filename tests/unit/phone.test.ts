import { describe, it, expect } from "vitest";
import { normalizePhone, formatPhone } from "@/server/domain/contacts/phone";

// Feature 032 (P5-R6): normalizePhone → one canonical stored form (E.164, +1 default; unparseable → raw;
// idempotent). formatPhone → dashed display (US), country code kept (non-US), raw passthrough.
describe("normalizePhone (032 US1)", () => {
  it("maps any US punctuation to +1 + 10 digits", () => {
    expect(normalizePhone("(585) 555-1234")).toBe("+15855551234");
    expect(normalizePhone("585.555.1234")).toBe("+15855551234");
    expect(normalizePhone("5855551234")).toBe("+15855551234");
    expect(normalizePhone("585 555 1234")).toBe("+15855551234");
  });

  it("treats 11 digits leading with 1 (with/without +) as US", () => {
    expect(normalizePhone("1-585-555-1234")).toBe("+15855551234");
    expect(normalizePhone("+1 585 555 1234")).toBe("+15855551234");
  });

  it("is idempotent on an already-canonical value", () => {
    expect(normalizePhone("+15855551234")).toBe("+15855551234");
  });

  it("keeps a non-US number canonical with its country code", () => {
    expect(normalizePhone("+44 20 7946 0958")).toBe("+442079460958");
  });

  it("stores unparseable input as entered (raw)", () => {
    expect(normalizePhone("555-1234")).toBe("555-1234"); // 7 digits
    expect(normalizePhone("585-555-1234 x89")).toBe("585-555-1234 x89"); // extension
    expect(normalizePhone("call Mary")).toBe("call Mary"); // letters
  });

  it("treats empty / whitespace as no phone", () => {
    expect(normalizePhone("")).toBe("");
    expect(normalizePhone("   ")).toBe("");
  });
});

describe("formatPhone (032 US2)", () => {
  it("renders a US canonical number dashed", () => {
    expect(formatPhone("+15855551234")).toBe("585-555-1234");
  });

  it("keeps a non-US number's country code", () => {
    expect(formatPhone("+442079460958")).toBe("+442079460958");
    expect(formatPhone("+442079460958").startsWith("+44")).toBe(true);
  });

  it("passes a raw/unparseable value through unchanged", () => {
    expect(formatPhone("585-555-1234 x89")).toBe("585-555-1234 x89");
    expect(formatPhone("")).toBe("");
  });
});
