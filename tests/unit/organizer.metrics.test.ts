import { describe, expect, it } from "vitest";
import { avgTicketCents, breakEvenDancers, payingDancers } from "@/server/domain/organizer/danceResult";

// FR-005, FR-006, FR-013
describe("organizer metrics", () => {
  it("paying dancers = attendance − performers − 1 (floored at 0)", () => {
    expect(payingDancers(60, 4)).toBe(55); // 60 − 4 − 1
    expect(payingDancers(2, 3)).toBe(0); // floored
  });

  it("avg ticket = admission ÷ dancers; 0 when no dancers", () => {
    expect(avgTicketCents(11000, 55)).toBe(200); // $2.00
    expect(avgTicketCents(11000, 0)).toBe(0);
  });

  it("break-even dancers only when Dance Net < 0 (and avg ticket > 0)", () => {
    expect(breakEvenDancers(-1000, 500)).toBe(2); // ceil(1000/500)
    expect(breakEvenDancers(500, 500)).toBeNull(); // positive net
    expect(breakEvenDancers(-1000, 0)).toBeNull(); // no avg ticket
  });
});
