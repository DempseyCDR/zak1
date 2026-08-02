// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PaymentsPage from "@/app/(admin)/payments/page";

// Feature 030 (P5-R3) US3: entering 0 + no check# on a payable row confirms, then flips the booking to
// donated via POST /api/bookings/[id]/donate; the row re-renders free.
type Call = { url: string; method: string };
const EVENTS = [
  { id: "ev1", eventDate: "2020-06-15", seriesId: "s1", startTime: "19:30:00", label: "TNC" },
];

function stub(calls: Call[], state: { donated: boolean }) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      const method = init?.method ?? "GET";
      calls.push({ url: u, method });
      // Mutate here (in the fetch body), not in json() — the success path doesn't read the donate body.
      if (u.includes("/api/bookings/b1/donate") && method === "POST") state.donated = true;
      const json = async () => {
        const booking = {
          id: "b1",
          performerId: "p1",
          performerName: "Lead Larry",
          performerType: "lead_musician",
          payCents: state.donated ? 0 : 12500,
          requiresCheck: !state.donated,
          isDonated: state.donated,
        };
        if (u.includes("/api/series")) return { items: [{ id: "s1", key: "tnc", name: "TNC" }] };
        if (u.includes("/api/bookings/b1/donate") && method === "POST") return { id: "b1" };
        if (u.includes("/api/events/ev1/bookings")) return { bookings: [booking] };
        if (u.includes("/api/events/ev1/performer-payments"))
          return {
            payments: [],
            reconciliation: { expected: 0, actual: 0, delta: 0 },
            settledByBooking: { b1: 0 },
          };
        if (u.includes("/api/events")) return { items: EVENTS };
        if (u.includes("/api/performers")) return { items: [] };
        if (u.includes("/api/membership-captures/parked")) return { parked: [] };
        return { items: [] };
      };
      return { ok: true, status: 200, json };
    }),
  );
}

const row = () => screen.getByText("Lead Larry").closest("li") as HTMLElement;

describe("PaymentsPage — donate at settlement (030 US3)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("0 + no check# confirms, calls the donate endpoint, and the row becomes free", async () => {
    const calls: Call[] = [];
    stub(calls, { donated: false });
    const user = userEvent.setup();
    render(<PaymentsPage />);
    await screen.findByText("Lead Larry");

    await user.type(screen.getByLabelText("Amount for Lead Larry"), "0");
    await user.click(within(row()).getByRole("button", { name: "Record" }));

    const dialog = await screen.findByRole("dialog", { name: /confirm donation/i });
    expect(calls.some((c) => c.url.includes("/donate"))).toBe(false); // not yet
    await user.click(within(dialog).getByRole("button", { name: /confirm donation/i }));

    await waitFor(() =>
      expect(
        calls.some((c) => c.url.includes("/api/bookings/b1/donate") && c.method === "POST"),
      ).toBe(true),
    );
    // Row re-renders as free (no check field, labelled donated).
    await waitFor(() => expect(row()).toHaveTextContent(/donated/i));
    expect(screen.queryByLabelText("Amount for Lead Larry")).not.toBeInTheDocument();
  });
});
