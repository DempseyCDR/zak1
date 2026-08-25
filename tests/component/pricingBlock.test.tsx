// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import PricingBlock from "@/app/(public)/_components/PricingBlock";

// Feature 054 (P7-R10): the detail/landing pricing render — tiers list (with a $0 "Free" tier), a flat
// special, and nothing for null.
describe("PricingBlock", () => {
  it("renders a tier list, with a $0 tier shown as Free", () => {
    render(
      <PricingBlock
        pricing={{
          kind: "tiers",
          tiers: [
            { label: "Supporter", amount: 15 },
            { label: "Student", amount: 5 },
            { label: "Musicians", amount: 0 },
          ],
        }}
      />,
    );
    expect(screen.getByText("Supporter")).toBeInTheDocument();
    expect(screen.getByText("$15")).toBeInTheDocument();
    expect(screen.getByText("$5")).toBeInTheDocument();
    expect(screen.getByText("Musicians")).toBeInTheDocument();
    expect(screen.getByText("Free")).toBeInTheDocument();
  });

  it("renders a flat special price", () => {
    render(<PricingBlock pricing={{ kind: "flat", amount: 25 }} />);
    expect(screen.getByText("$25")).toBeInTheDocument();
  });

  it("renders nothing for null (no price configured)", () => {
    const { container } = render(<PricingBlock pricing={null} />);
    expect(container.firstChild).toBeNull();
  });
});
