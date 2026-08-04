// @vitest-environment jsdom
import type { ReactNode } from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Feature 034 (P6-R1): the public navigation menu. usePathname drives active-state (FR-004); mock it
// per case. next/link needs the Next runtime, so stub it to a plain <a> (links then assert by
// role/name/href) — the same approach the suite uses for other Next-runtime modules.
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

afterEach(() => {
  vi.unstubAllGlobals();
  mockPath.mockReturnValue("/whats-on");
});

describe("PublicNav — US1: consistent menu of public destinations", () => {
  it("renders a Site nav landmark, the wordmark home link, and one link per PUBLIC_NAV entry", () => {
    render(<PublicNav />);
    // Nav landmark, distinct from the volunteer nav's aria-label="Main".
    const nav = screen.getByRole("navigation", { name: "Site" });
    expect(nav).toBeInTheDocument();
    // Wordmark / home affordance (FR-006).
    const home = screen.getByRole("link", { name: "Country Dancers of Rochester" });
    expect(home).toHaveAttribute("href", "/whats-on");
    // One link per entry, data-driven from PUBLIC_NAV (FR-002).
    for (const entry of PUBLIC_NAV) {
      expect(screen.getByRole("link", { name: entry.label })).toHaveAttribute("href", entry.href);
    }
  });

  it("is presentation only — renders the full entry set with no auth input and issues no fetch (FR-005)", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    render(<PublicNav />);
    // No props, no context, no data call — the menu makes no authorization decision.
    expect(fetchSpy).not.toHaveBeenCalled();
    for (const entry of PUBLIC_NAV) {
      expect(screen.getByRole("link", { name: entry.label })).toBeInTheDocument();
    }
  });
});

describe("PublicNav — US2: current section marked active (FR-004)", () => {
  it("marks What's On active on the home page", () => {
    mockPath.mockReturnValue("/whats-on");
    render(<PublicNav />);
    expect(screen.getByRole("link", { name: "What's On" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Join" })).not.toHaveAttribute("aria-current");
  });

  it("keeps What's On active on an event detail page (parent section)", () => {
    mockPath.mockReturnValue("/whats-on/evt-123");
    render(<PublicNav />);
    expect(screen.getByRole("link", { name: "What's On" })).toHaveAttribute("aria-current", "page");
  });

  it("marks Join active on /join", () => {
    mockPath.mockReturnValue("/join");
    render(<PublicNav />);
    expect(screen.getByRole("link", { name: "Join" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "What's On" })).not.toHaveAttribute("aria-current");
  });

  it("marks no public entry active on a staff page", () => {
    mockPath.mockReturnValue("/gate");
    render(<PublicNav />);
    for (const entry of PUBLIC_NAV) {
      expect(screen.getByRole("link", { name: entry.label })).not.toHaveAttribute("aria-current");
    }
  });
});

describe("PublicNav — US3: render is driven by PUBLIC_NAV (single source, FR-003/SC-003)", () => {
  it("renders exactly the PUBLIC_NAV entries, in order, and no more", () => {
    render(<PublicNav />);
    // All links minus the leading wordmark home link = the entry links, in DOM order.
    const entryLinks = screen
      .getAllByRole("link")
      .filter((a) => a.getAttribute("href") !== "/whats-on" || a.textContent !== "Country Dancers of Rochester");
    const rendered = entryLinks.map((a) => ({ label: a.textContent, href: a.getAttribute("href") }));
    expect(rendered).toEqual(PUBLIC_NAV.map((e) => ({ label: e.label, href: e.href })));
  });
});
