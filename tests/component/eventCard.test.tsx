// @vitest-environment jsdom
import type { ReactNode } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Feature 048 (P7-R4): the event card. next/link is stubbed to a plain <a> so the whole-card link is testable.
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

import EventCard from "@/app/(public)/_components/EventCard";
import type { PublicScheduleItem } from "@/server/domain/public/publicSchedule";

function item(overrides: Partial<PublicScheduleItem> = {}): PublicScheduleItem {
  return {
    eventId: "e1",
    date: "2026-06-09",
    activity: "Thursday Night Contra",
    seriesKey: "tnc",
    venueName: "The Rose Room",
    venueShortName: "Rose",
    label: null,
    startTime: "7:30 PM",
    cancelled: false,
    advertisedPrice: 12,
    ...overrides,
  };
}

describe("EventCard", () => {
  it("is a whole-card link to the event detail page", () => {
    render(<EventCard item={item()} />);
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/whats-on/e1");
  });

  it("shows the date, start time, venue short name, and price", () => {
    render(<EventCard item={item()} />);
    expect(screen.getByText("2026-06-09")).toBeInTheDocument();
    expect(screen.getByText(/7:30 PM/)).toBeInTheDocument();
    expect(screen.getByText(/Rose/)).toBeInTheDocument();
    expect(screen.getByText(/\$12\.00/)).toBeInTheDocument();
  });

  it("falls back to the full venue name when there is no short name", () => {
    render(<EventCard item={item({ venueShortName: null })} />);
    expect(screen.getByText(/The Rose Room/)).toBeInTheDocument();
  });

  it("omits the venue line entirely when neither short nor full name is present", () => {
    render(<EventCard item={item({ venueShortName: null, venueName: null })} />);
    expect(screen.queryByText(/Rose/)).not.toBeInTheDocument();
  });

  it("omits the price line when there is no advertised price", () => {
    render(<EventCard item={item({ advertisedPrice: null })} />);
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
  });

  it("marks a cancelled event", () => {
    render(<EventCard item={item({ cancelled: true })} />);
    expect(screen.getByText(/CANCELLED/i)).toBeInTheDocument();
  });

  it("sets the --card-accent CSS variable from the series color map", () => {
    const { container } = render(<EventCard item={item({ seriesKey: "ecd" })} />);
    const card = container.querySelector("a");
    expect(card?.getAttribute("style")).toContain("--card-accent: var(--type-english)");
  });

  it("uses the neutral accent for an unmapped series", () => {
    const { container } = render(<EventCard item={item({ seriesKey: "mystery" })} />);
    const card = container.querySelector("a");
    expect(card?.getAttribute("style")).toContain("--card-accent: var(--band)");
  });

  it("renders no <h1> (the page owns the single H1)", () => {
    const { container } = render(<EventCard item={item()} />);
    expect(container.querySelector("h1")).toBeNull();
  });
});
