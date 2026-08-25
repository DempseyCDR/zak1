import { describe, it, expect } from "vitest";
import { CLUB_ROLES, BOARD_ROLES, isRoleKey, isBoardRoleKey } from "@/server/domain/org/clubRoles";

// Feature 055 (P7-R12): the committed club-role registry — the shared source for the contact directory and the
// board page. Aliases are club role addresses (not personal PII).
const ALIAS = /^[a-z0-9._-]+@cdrochester\.org$/;

describe("club-role registry", () => {
  it("has unique keys and unique orders", () => {
    const keys = CLUB_ROLES.map((r) => r.key);
    const orders = CLUB_ROLES.map((r) => r.order);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(orders).size).toBe(orders.length);
  });

  it("every alias is a lowercase @cdrochester.org role address", () => {
    for (const r of CLUB_ROLES) expect(r.emailAlias).toMatch(ALIAS);
  });

  it("BOARD_ROLES are exactly the board seats, in order", () => {
    expect(BOARD_ROLES.every((r) => r.isBoardSeat)).toBe(true);
    expect(BOARD_ROLES.map((r) => r.key)).toEqual(
      CLUB_ROLES.filter((r) => r.isBoardSeat)
        .sort((a, b) => a.order - b.order)
        .map((r) => r.key),
    );
    // there is at least one non-board alias so the distinction is real
    expect(CLUB_ROLES.some((r) => !r.isBoardSeat)).toBe(true);
  });

  it("isRoleKey / isBoardRoleKey guard the admin write", () => {
    expect(isRoleKey("treasurer")).toBe(true);
    expect(isRoleKey("nope")).toBe(false);
    expect(isBoardRoleKey("treasurer")).toBe(true);
    expect(isBoardRoleKey("info")).toBe(false); // exists but not a board seat
    expect(isBoardRoleKey("nope")).toBe(false);
  });
});
