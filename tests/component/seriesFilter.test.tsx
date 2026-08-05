// @vitest-environment jsdom
import type { ReactNode } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Feature 037 (P6-R5): the server-rendered series filter (URL query param). next/link stubbed to <a>.
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode; [k: string]: unknown }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import SeriesFilter from "@/app/(public)/_components/SeriesFilter";

const SERIES = [
  { key: "tnc", name: "Thursday Night Contra" },
  { key: "ecd", name: "English Country Dance" },
];

describe("SeriesFilter", () => {
  it("renders an All link plus one ?series=<key> link per series, using basePath", () => {
    render(<SeriesFilter series={SERIES} basePath="/what-was-on" />);
    const links = screen.getAllByRole("link");
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "/what-was-on",
      "/what-was-on?series=tnc",
      "/what-was-on?series=ecd",
    ]);
  });

  it("marks the selected series as current, and All otherwise", () => {
    render(<SeriesFilter series={SERIES} selected="tnc" basePath="/whats-on" />);
    expect(screen.getByRole("link", { name: "Thursday Night Contra" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "All" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "English Country Dance" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("marks All as current when nothing is selected", () => {
    render(<SeriesFilter series={SERIES} basePath="/whats-on" />);
    expect(screen.getByRole("link", { name: "All" })).toHaveAttribute("aria-current", "page");
  });
});
