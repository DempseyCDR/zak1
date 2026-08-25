// @vitest-environment jsdom
import type { ReactNode } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Feature 037 (P6-R4): the shared list used by /whats-on and /what-was-on. next/link stubbed to <a>.
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

import ScheduleList from "@/app/(public)/_components/ScheduleList";
import type { PublicScheduleItem } from "@/server/domain/public/publicSchedule";

const ITEMS: PublicScheduleItem[] = [
  {
    eventId: "e1",
    date: "2026-06-09",
    activity: "Thursday Night Contra",
    seriesKey: "tnc",
    venueName: "The Rose Room",
    venueShortName: "Rose",
    label: null,
    startTime: "7:30 PM",
    cancelled: false,
    pricing: { kind: "flat", amount: 12 },
  },
  {
    eventId: "e2",
    date: "2026-06-08",
    activity: "English Country Dance",
    seriesKey: "ecd",
    venueName: null,
    venueShortName: null,
    label: "Special",
    startTime: null,
    cancelled: true,
    pricing: null,
  },
];

describe("ScheduleList", () => {
  it("renders one card per item, each a whole-card link to its /whats-on/<eventId> detail", () => {
    render(<ScheduleList items={ITEMS} />);
    const links = screen.getAllByRole("link");
    expect(links.map((a) => a.getAttribute("href"))).toEqual(["/whats-on/e1", "/whats-on/e2"]);
    expect(screen.getByText(/Thursday Night Contra/)).toBeInTheDocument();
    expect(screen.getByText(/Cancelled/i)).toBeInTheDocument(); // e2 cancelled marker
  });

  it("shows the empty message when there are no items", () => {
    render(<ScheduleList items={[]} emptyMessage="No past dances to show." />);
    expect(screen.getByText("No past dances to show.")).toBeInTheDocument();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});
