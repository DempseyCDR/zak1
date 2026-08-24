// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Feature 049 (P7-R5): next/image stubbed to a plain <img> so the hero's src/alt are testable.
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string; [k: string]: unknown }) => (
    <img src={typeof src === "string" ? src : ""} alt={alt} />
  ),
}));

import EventHero from "@/app/(public)/_components/EventHero";

describe("EventHero", () => {
  it("renders the series' hero image (with alt) for a mapped series", () => {
    render(<EventHero seriesKey="tnc" activity="Thursday Night Contra" />);
    const img = screen.getByRole("img");
    expect(img.getAttribute("src")).toBe("/series/contra.webp");
    expect(img.getAttribute("alt")).toBe("Thursday Night Contra");
  });

  it("renders a clean header (no image) for an unmapped series", () => {
    const { container } = render(<EventHero seriesKey="mystery" activity="Some Dance" />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });

  it("renders no <h1> (the page owns the single H1)", () => {
    const { container } = render(<EventHero seriesKey="ecd" activity="English" />);
    expect(container.querySelector("h1")).toBeNull();
  });
});
