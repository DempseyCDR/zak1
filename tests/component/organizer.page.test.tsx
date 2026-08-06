// @vitest-environment jsdom
import { Suspense } from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OrganizerReportPage from "@/app/(admin)/organizer/[seriesKey]/page";

// Feature 041 (P6-R11): the organizer report's band column shows the booked band's NAME, and the per-dance
// detail expansion lists the band's members by name and role (and shows the band name). This test stubs the
// report fetch — it is UI-boundary isolation, not the DB-no-mock rule (which governs integration tests).

const ZERO_BUCKET = { count: 0, avgDancers: 0, avgGross: 0, avgDanceNet: 0, avgTicket: 0 };

function row(overrides: Record<string, unknown>) {
  return {
    eventId: "e1",
    date: "2026-06-18",
    series: "tnc",
    caller: "Cal Caller",
    band: "",
    dancers: 0,
    grossGate: 0,
    merchandise: 0,
    rent: 0,
    performerTotal: 0,
    ongoingExpense: 0,
    miscExpenses: 0,
    danceNet: 0,
    danceNetNegative: false,
    avgTicket: 0,
    breakEvenDancers: null,
    performers: [],
    fyi: { donations: 0, memberships: 0, futureEvent: 0, giftCards: 0, miscSales: 0 },
    ...overrides,
  };
}

const REPORT = {
  series: { key: "tnc", name: "TNC" },
  perDanceRows: [
    row({
      eventId: "e_band",
      band: "The Fiddleheads",
      performers: [
        { name: "Alice Fiddle", type: "lead_musician", amount: 100 },
        { name: "Bob Piano", type: "musician", amount: 100 },
      ],
    }),
    row({
      eventId: "e_adhoc",
      date: "2026-06-11",
      band: "Ada Adhoc, Ben Busker",
      performers: [
        { name: "Ada Adhoc", type: "lead_musician", amount: 100 },
        { name: "Ben Busker", type: "musician", amount: 100 },
      ],
    }),
  ],
  quarterlySummary: { quarters: [], ytd: ZERO_BUCKET, lastYear: ZERO_BUCKET },
  trend: null,
};

function stub() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const u = String(url);
      const json = async () => (u.includes("/organizer/") ? REPORT : { items: [] });
      return { ok: true, status: 200, json };
    }),
  );
}

describe("OrganizerReportPage — band name + member detail (041)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows the band name in the column and the members (by name + role) on drill-in", async () => {
    stub();
    const user = userEvent.setup();
    // The page reads `params` via React `use`, which suspends; flush that suspension inside an awaited act.
    await act(async () => {
      render(
        <Suspense fallback={null}>
          <OrganizerReportPage params={Promise.resolve({ seriesKey: "tnc" })} />
        </Suspense>,
      );
    });

    // Band column shows the band's NAME for a named band, and joined names for the ad-hoc dance.
    expect(await screen.findByText("The Fiddleheads")).toBeInTheDocument();
    expect(screen.getByText("Ada Adhoc, Ben Busker")).toBeInTheDocument();

    // Drill into the named-band dance → the detail lists the members by name and role, and shows the band.
    await user.click(screen.getByText("The Fiddleheads"));
    const detail = screen.getByText(/Performers:/i).closest("td")!;
    expect(detail).toHaveTextContent("The Fiddleheads"); // band name label in the detail
    expect(detail).toHaveTextContent("Alice Fiddle (lead_musician");
    expect(detail).toHaveTextContent("Bob Piano (musician");
  });
});
