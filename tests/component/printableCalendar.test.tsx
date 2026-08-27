// @vitest-environment jsdom
import type { ReactNode } from "react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import PrintableCalendarView from "@/app/(public)/printable-calendar/PrintableCalendarView";
import type { PrintableCalendar } from "@/server/domain/public/printableCalendar";

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

// Feature 058 (P7-R15, jsdom): the presentational view — table (th scope), footer schedule+prices, header start,
// the screen-only GET date form, the truncated pointer, cancelled marker, and the empty state.

const base: PrintableCalendar = {
  startISO: "2026-11-01",
  rows: [
    {
      dateISO: "2026-11-05",
      dateDisplay: "Nov 5",
      series: "TNC",
      band: "The Reel Thing",
      caller: "Jane Smith",
      venue: "GH",
      cancelled: false,
      description: "Driving fiddle-and-piano contra; lesson at 7.",
    },
    {
      dateISO: "2026-11-08",
      dateDisplay: "Nov 8",
      series: "ECD",
      band: null,
      caller: null,
      venue: "Downtown UU",
      cancelled: true,
      description: null,
    },
  ],
  truncated: false,
  seriesSchedules: [
    {
      seriesKey: "tnc",
      name: "Thursday Night Contra",
      sentence: "Thursdays, 7:30 PM.",
      price: "$12–$15",
    },
    {
      seriesKey: "ecd",
      name: "English Country Dance",
      sentence: "Second Sundays, 6:30 PM.",
      price: "Free",
    },
  ],
};

afterEach(cleanup);

describe("PrintableCalendarView", () => {
  it("renders a table with column-scoped headers and a row per event", () => {
    render(<PrintableCalendarView calendar={base} />);
    const table = screen.getByRole("table");
    const headers = within(table).getAllByRole("columnheader");
    expect(headers.map((h) => h.textContent)).toEqual(["Date", "Series", "Band / Caller", "Venue"]);
    headers.forEach((h) => expect(h.getAttribute("scope")).toBe("col"));
    // header + a row per event + one extra sub-row per event that has a description.
    const described = base.rows.filter((r) => r.description).length;
    expect(within(table).getAllByRole("row")).toHaveLength(1 + base.rows.length + described);
    expect(within(table).getByText("TNC")).toBeTruthy(); // series short code
    expect(within(table).getByText("The Reel Thing w/Jane Smith")).toBeTruthy(); // band w/caller
  });

  it("renders the description as a full-width sub-line only for events that have one", () => {
    render(<PrintableCalendarView calendar={base} />);
    const desc = screen.getByText("Driving fiddle-and-piano contra; lesson at 7.");
    expect(desc.closest("td")!.getAttribute("colspan")).toBe("4"); // full width
    // the second (ECD) event has no description → only one description cell in the table
    expect(screen.getAllByText(/contra; lesson at 7\./)).toHaveLength(1);
  });

  it("marks a cancelled event", () => {
    render(<PrintableCalendarView calendar={base} />);
    const table = screen.getByRole("table");
    const cancelledRow = within(table).getByText("ECD").closest("tr")!;
    expect(cancelledRow.textContent).toMatch(/cancelled/i);
  });

  it("shows the effective start in the header", () => {
    render(<PrintableCalendarView calendar={base} />);
    // formatCalendarDate("2026-11-01") → Nov 1
    expect(screen.getByText(/Upcoming dances from/i).textContent).toMatch(/Nov 1/);
  });

  it("renders a screen-only GET date form defaulted to the start", () => {
    render(<PrintableCalendarView calendar={base} />);
    const input = screen.getByLabelText(/start/i) as HTMLInputElement;
    expect(input.getAttribute("name")).toBe("start");
    expect(input.getAttribute("type")).toBe("date");
    expect(input.defaultValue).toBe("2026-11-01");
    const form = input.closest("form")!;
    expect(form.getAttribute("method")).toBe("get");
  });

  it("lists each series' sentence and price in the footer", () => {
    render(<PrintableCalendarView calendar={base} />);
    expect(screen.getByText("Thursdays, 7:30 PM.")).toBeTruthy();
    expect(screen.getByText(/\$12–\$15/)).toBeTruthy();
    expect(screen.getByText("Free")).toBeTruthy();
  });

  it("shows the 'see the full schedule online' pointer only when truncated", () => {
    const { rerender } = render(<PrintableCalendarView calendar={base} />);
    expect(screen.queryByText(/full schedule online/i)).toBeNull();
    rerender(<PrintableCalendarView calendar={{ ...base, truncated: true }} />);
    const link = screen.getByRole("link", { name: /full schedule online/i });
    expect(link.getAttribute("href")).toBe("/whats-on");
  });

  it("shows a 'no dances currently scheduled' note when there are no rows", () => {
    render(<PrintableCalendarView calendar={{ ...base, rows: [] }} />);
    expect(screen.getByText(/no dances currently scheduled/i)).toBeTruthy();
    // footer still present
    expect(screen.getByText("Thursdays, 7:30 PM.")).toBeTruthy();
  });
});
