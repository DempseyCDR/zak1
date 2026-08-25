import { describe, it, expect } from "vitest";
import { membershipYearLabel } from "@/server/domain/org/membershipYear";

// Feature 055 (P7-R12): the public year-window label from the MM-DD end (start = the day after).
describe("membershipYearLabel", () => {
  it("renders the club's Aug 31 year-end as the Sep 1 – Aug 31 window", () => {
    expect(membershipYearLabel("08-31")).toBe("September 1 – August 31");
  });

  it("handles a Dec 31 year-end (Jan 1 – Dec 31)", () => {
    expect(membershipYearLabel("12-31")).toBe("January 1 – December 31");
  });
});
