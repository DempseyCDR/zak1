// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BookingsReportPage from "@/app/(admin)/bookings-report/page";

type Call = { url: string };
function stub(
  calls: Call[],
  caps: { bookingWrite: boolean; eventWrite: boolean },
  rows: unknown[],
) {
  return vi.fn(async (url: string) => {
    calls.push({ url });
    const json = async () => {
      if (url.includes("/api/me/capabilities")) return caps;
      if (url.includes("/api/bookings/report")) return { rows };
      return { items: [] }; // series/performers/bands/venues
    };
    return { ok: true, status: 200, json };
  });
}

const ROWS = [
  {
    eventId: "e1",
    date: "2026-06-18",
    series: "Thursday Night Contra",
    venueShortName: "GH",
    hasSoundTech: true,
    caller: "Pat Caller",
    band: null,
    musicians: ["Ann"],
    soundTech: null,
    cancelled: false,
    bookings: [
      {
        bookingId: "b1",
        performerId: "p1",
        performer: "Pat Caller",
        type: "caller",
        status: "tentative",
      },
      {
        bookingId: "b2",
        performerId: "p2",
        performer: "Ann",
        type: "musician",
        status: "confirmed",
      },
    ],
  },
  {
    eventId: "e2",
    date: "2026-06-21",
    series: "Community Dance",
    venueShortName: "TRR",
    hasSoundTech: false,
    caller: null,
    band: null,
    musicians: [],
    soundTech: null,
    cancelled: false,
    bookings: [],
  },
];

describe("BookingsReportPage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows venue short names and per-performer status letters; sort toggles re-request desc", async () => {
    const calls: Call[] = [];
    vi.stubGlobal("fetch", stub(calls, { bookingWrite: true, eventWrite: true }, ROWS));
    const user = userEvent.setup();
    render(<BookingsReportPage />);

    await waitFor(() => screen.getByText("GH"));
    expect(screen.getByText("TRR")).toBeInTheDocument();
    // Tentative caller → letter T; confirmed musician → C.
    const row = screen.getByText("Pat Caller").closest("tr")!;
    expect(within(row).getByText("T")).toBeInTheDocument();
    expect(within(row).getByText("C")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /sort/i }));
    await waitFor(() =>
      expect(
        calls.some((c) => c.url.includes("/api/bookings/report") && c.url.includes("sort=desc")),
      ).toBe(true),
    );
  });

  it("renders empty role slots, omitting sound-tech when the series has none", async () => {
    vi.stubGlobal("fetch", stub([], { bookingWrite: true, eventWrite: true }, ROWS));
    render(<BookingsReportPage />);
    await waitFor(() => screen.getByText("TRR"));

    // e1 (tnc, hasSoundTech) has no sound tech booked → an "add sound tech" slot appears.
    const e1 = screen.getByText("GH").closest("tr")!;
    expect(within(e1).getByRole("button", { name: /add sound tech/i })).toBeInTheDocument();
    // e2 (community_dance) has NO sound-tech slot at all.
    const e2 = screen.getByText("TRR").closest("tr")!;
    expect(within(e2).queryByRole("button", { name: /add sound tech/i })).not.toBeInTheDocument();
    // Always an "add musician" affordance.
    expect(within(e2).getByRole("button", { name: /add musician/i })).toBeInTheDocument();
  });

  it("shows no edit affordances for a non-Booker (read-only)", async () => {
    vi.stubGlobal("fetch", stub([], { bookingWrite: false, eventWrite: false }, ROWS));
    render(<BookingsReportPage />);
    await waitFor(() => screen.getByText("GH"));
    expect(screen.queryByRole("button", { name: /add musician/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add caller/i })).not.toBeInTheDocument();
  });
});
