// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TreasurerReportPage from "@/app/(admin)/treasurer/page";

// Feature 028 (P5-R1) US4 + FR-010: the treasurer report is a single `/treasurer` page (no `[eventId]` URL).
// It renders the shared selector + the report for the default event, and reloads the report when the
// selected event changes. Dates far in the past so the "≤ today" default is deterministic.
const EVENTS = [
  {
    id: "e_recent",
    eventDate: "2020-06-15",
    seriesId: "s1",
    startTime: "19:30:00",
    label: "Contra",
  },
  { id: "e_old", eventDate: "2020-01-10", seriesId: "s1", startTime: null, label: null },
];
const SERIES = [{ id: "s1", key: "tnc", name: "TNC" }];

function report(eventId: string) {
  return {
    event: {
      id: eventId,
      date: eventId === "e_old" ? "2020-01-10" : "2020-06-15",
      seriesKey: "tnc",
    },
    gateSalesSummary: {
      customer: `Cust ${eventId}`,
      posVerification: { gross: 0, fee: 0 },
      lines: [],
    },
    namedCustomerReceipts: [],
    performerPayments: [],
    deposit: { account: "1000", amount: 0 },
    fees: { account: "6000", doorFee: 0, onlineFee: 0, total: 0 },
    nonDanceIncome: { account: "4000", lines: [], total: 0 },
  };
}

function stub() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const u = String(url);
      const json = async () => {
        const m = /\/events\/([^/]+)\/treasurer-report/.exec(u);
        if (m) return report(m[1]!);
        if (u.includes("/api/series")) return { items: SERIES };
        if (u.includes("/api/events")) return { items: EVENTS };
        return { items: [] };
      };
      return { ok: true, status: 200, json };
    }),
  );
}

describe("TreasurerReportPage — /treasurer single page + selector (028)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("renders the report for the default event and reloads when the event changes", async () => {
    stub();
    const user = userEvent.setup();
    render(<TreasurerReportPage />);

    // Defaults to the most recent event ≤ today and loads its report.
    expect(await screen.findByText(/Gate Sales Summary — Cust e_recent/)).toBeInTheDocument();

    // Switching the selected event reloads the report.
    await user.selectOptions(screen.getByRole("combobox", { name: /^event$/i }), "e_old");
    expect(await screen.findByText(/Gate Sales Summary — Cust e_old/)).toBeInTheDocument();
  });
});
