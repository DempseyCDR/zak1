// @vitest-environment jsdom
import type { ReactNode } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Feature 047 (P7-R3, US3): the site-wide public footer — org identity, key links, a support affordance.
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: ReactNode;
    [k: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import Footer from "@/app/(public)/_components/Footer";

describe("public footer (US3 / 055 org cluster)", () => {
  it("renders a contentinfo landmark with org identity, key links, an About group, and a Donate affordance", () => {
    render(<Footer />);
    const footer = screen.getByRole("contentinfo");
    expect(footer).toBeInTheDocument();
    expect(footer.textContent).toMatch(/Country Dancers of Rochester/i);
    expect(screen.getByRole("link", { name: "What's On" })).toHaveAttribute("href", "/whats-on");
    expect(screen.getByRole("link", { name: "Join" })).toHaveAttribute("href", "/join");
    // Feature 055 (P7-R12): Contact Us (board + aliases, merged) in the footer — not the top nav.
    expect(screen.getByRole("link", { name: "Contact Us" })).toHaveAttribute("href", "/contact-us");
    // Donate affordance — distinct from Join, an outbound PayPal donation link.
    const donate = screen.getByRole("link", { name: "Donate" });
    expect(donate.getAttribute("href")).toMatch(/paypal\.com\/donate/);
    expect(donate).toHaveAttribute("target", "_blank");
  });
});
