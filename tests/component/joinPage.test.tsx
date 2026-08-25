// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import MembershipTiers from "@/app/(public)/_components/MembershipTiers";
import JoinForm from "@/app/(public)/join/JoinForm";

// Feature 055 (P7-R12): the membership page's presentational pieces (the async server page composes them). The
// tiers + year label + coverage-through date render; the capture form + PayPal handoff (019) are retained.
describe("MembershipTiers", () => {
  it("shows the four tiers with amounts, the year label, and the coverage-through date", () => {
    render(
      <MembershipTiers yearLabel="September 1 – August 31" coverageThrough="August 31, 2027" />,
    );
    const pairs: [string, string][] = [
      ["Supporter", "$50+"],
      ["Family", "$30"],
      ["Individual", "$20"],
      ["Student", "$10"],
    ];
    for (const [label, amount] of pairs) {
      expect(screen.getByText(label)).toBeInTheDocument();
      expect(screen.getByText(amount)).toBeInTheDocument();
    }
    expect(screen.getByText("September 1 – August 31")).toBeInTheDocument();
    expect(screen.getByText("August 31, 2027")).toBeInTheDocument();
  });
});

describe("JoinForm", () => {
  it("renders the name/email capture and the continue-to-payment button (019 flow retained)", () => {
    render(<JoinForm />);
    expect(screen.getByLabelText(/Name/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Continue to payment/ })).toBeInTheDocument();
  });
});
