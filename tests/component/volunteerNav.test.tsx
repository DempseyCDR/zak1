// @vitest-environment jsdom
import type { ReactNode } from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Feature 035 (P6-R2): the volunteer menu's client presenter. usePathname drives active-state (FR-008);
// next/link needs the Next runtime, so stub it to a plain <a> (same approach as PublicNav's test).
vi.mock("next/navigation", () => ({ usePathname: vi.fn(() => "/gate") }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode; [k: string]: unknown }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import VolunteerNav from "@/app/VolunteerNav";
import { usePathname } from "next/navigation";

const mockPath = vi.mocked(usePathname);
const ITEMS = [
  { href: "/gate", label: "Gate money" },
  { href: "/payments", label: "Payments" },
];

afterEach(() => mockPath.mockReturnValue("/gate"));

describe("VolunteerNav — presenter", () => {
  it("renders a Main nav landmark with one link per item, in order", () => {
    render(<VolunteerNav items={ITEMS} />);
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(nav).toBeInTheDocument();
    const links = screen.getAllByRole("link");
    expect(links.map((a) => a.textContent)).toEqual(["Gate money", "Payments"]);
    expect(screen.getByRole("link", { name: "Payments" })).toHaveAttribute("href", "/payments");
  });

  it("marks the current section active (aria-current) and only that one", () => {
    mockPath.mockReturnValue("/payments");
    render(<VolunteerNav items={ITEMS} />);
    expect(screen.getByRole("link", { name: "Payments" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Gate money" })).not.toHaveAttribute("aria-current");
  });

  it("keeps the parent section active on a sub-path", () => {
    mockPath.mockReturnValue("/payments/anything");
    render(<VolunteerNav items={ITEMS} />);
    expect(screen.getByRole("link", { name: "Payments" })).toHaveAttribute("aria-current", "page");
  });

  it("renders no links when items is empty", () => {
    render(<VolunteerNav items={[]} />);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});
