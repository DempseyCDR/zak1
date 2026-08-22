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

describe("public footer (US3)", () => {
  it("renders a contentinfo landmark with org identity, key links, and a support affordance", () => {
    render(<Footer />);
    const footer = screen.getByRole("contentinfo");
    expect(footer).toBeInTheDocument();
    expect(footer.textContent).toMatch(/Country Dancers of Rochester/i);
    expect(screen.getByRole("link", { name: "What's On" })).toHaveAttribute("href", "/whats-on");
    expect(screen.getByRole("link", { name: "Join" })).toHaveAttribute("href", "/join");
    // support/donate affordance
    expect(screen.getByRole("link", { name: /support/i })).toHaveAttribute("href", "/join");
  });
});
