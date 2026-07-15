import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/server/auth/redirect";

/**
 * Contracts §1: the `?next=` open-redirect guard.
 *
 * `next` survives the round trip to Google and back, so an unchecked value would let a crafted
 * sign-in link bounce a freshly authenticated officer to an attacker's site.
 */
describe("safeNextPath (open-redirect guard)", () => {
  it("honours a plain relative path", () => {
    expect(safeNextPath("/gate")).toBe("/gate");
    expect(safeNextPath("/organizer/ecd?q=1")).toBe("/organizer/ecd?q=1");
  });

  it("falls back for absent or empty values", () => {
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath(undefined)).toBe("/");
    expect(safeNextPath("")).toBe("/");
  });

  it.each([
    ["https://evil.com/steal", "absolute https"],
    ["http://evil.com", "absolute http"],
    ["//evil.com", "protocol-relative"],
    ["/\\evil.com", "backslash protocol-relative"],
    ["\\\\evil.com", "UNC-style"],
    ["javascript:alert(1)", "javascript scheme"],
    ["data:text/html,<script>", "data scheme"],
    ["gate", "not absolute"],
    ["/gate\nSet-Cookie: x=y", "header injection via newline"],
    ["/gate\r\nLocation: https://evil.com", "CRLF injection"],
  ])("refuses %s (%s)", (input) => {
    expect(safeNextPath(input)).toBe("/");
  });

  it("uses the supplied fallback", () => {
    expect(safeNextPath("https://evil.com", "/login")).toBe("/login");
  });
});
