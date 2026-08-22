// @vitest-environment jsdom
import type { ReactNode } from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Feature 046 (P7-R2): the mobile disclosure behavior. usePathname drives active-state + close-on-nav;
// next/link is stubbed to a plain <a> as the 034 test does. jsdom applies no CSS, so all links stay in the
// DOM regardless of the panel's CSS display — behavior/ARIA/focus is what these assert; sizing/breakpoint
// are browser-verified (quickstart).
vi.mock("next/navigation", () => ({ usePathname: vi.fn(() => "/whats-on") }));
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

import PublicNav from "@/app/PublicNav";
import { PUBLIC_NAV } from "@/app/publicNavItems";
import { usePathname } from "next/navigation";

const mockPath = vi.mocked(usePathname);
afterEach(() => mockPath.mockReturnValue("/whats-on"));

function toggle() {
  return screen.getByRole("button", { name: /menu/i });
}

describe("PublicNav mobile disclosure — US1: compact bar with a toggle", () => {
  it("exposes a labeled toggle, collapsed by default, that opens on click", () => {
    render(<PublicNav />);
    expect(toggle()).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle());
    expect(toggle()).toHaveAttribute("aria-expanded", "true");
  });

  it("keeps every destination + the wordmark in the DOM in both states", () => {
    render(<PublicNav />);
    expect(screen.getByRole("link", { name: "Country Dancers of Rochester" })).toBeInTheDocument();
    for (const entry of PUBLIC_NAV) {
      expect(screen.getByRole("link", { name: entry.label })).toHaveAttribute("href", entry.href);
    }
  });
});

describe("PublicNav mobile disclosure — US2: accessible", () => {
  it("closes on Escape and returns focus to the toggle", () => {
    render(<PublicNav />);
    fireEvent.click(toggle());
    expect(toggle()).toHaveAttribute("aria-expanded", "true");
    fireEvent.keyDown(toggle(), { key: "Escape" });
    expect(toggle()).toHaveAttribute("aria-expanded", "false");
    expect(toggle()).toHaveFocus();
  });

  it("closes on route change", () => {
    const { rerender } = render(<PublicNav />);
    fireEvent.click(toggle());
    expect(toggle()).toHaveAttribute("aria-expanded", "true");
    mockPath.mockReturnValue("/join");
    rerender(<PublicNav />);
    expect(toggle()).toHaveAttribute("aria-expanded", "false");
  });

  it("the panel is referenced by the toggle via aria-controls", () => {
    render(<PublicNav />);
    const panelId = toggle().getAttribute("aria-controls");
    expect(panelId).toBeTruthy();
    expect(document.getElementById(panelId!)).not.toBeNull();
  });
});
