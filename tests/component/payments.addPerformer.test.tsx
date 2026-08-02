// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PaymentsPage from "@/app/(admin)/payments/page";

// Feature 030 (P5-R3) US6: the add-performer control creates a booking for an unbooked performer via
// POST /api/events/[id]/settlement-performer, then the new row appears (ready to record a check).
type Call = { url: string; method: string; body: unknown };
const EVENTS = [
  { id: "ev1", eventDate: "2020-06-15", seriesId: "s1", startTime: "19:30:00", label: "TNC" },
];

function stub(calls: Call[], state: { added: boolean }) {
  const base = [
    {
      id: "b1",
      performerId: "p1",
      performerName: "Pat Caller",
      performerType: "caller",
      payCents: 15000,
      requiresCheck: true,
      isDonated: false,
    },
  ];
  const walkin = {
    id: "b2",
    performerId: "p9",
    performerName: "Walkin Wendy",
    performerType: "musician",
    payCents: 6000,
    requiresCheck: true,
    isDonated: false,
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ url: u, method, body });
      // Mutate here (in the fetch body), not in json() — the success path doesn't read the POST body.
      if (u.includes("/settlement-performer") && method === "POST") state.added = true;
      const json = async () => {
        if (u.includes("/api/series")) return { items: [{ id: "s1", key: "tnc", name: "TNC" }] };
        if (u.includes("/settlement-performer") && method === "POST") return { id: "b2" };
        if (u.includes("/api/events/ev1/bookings"))
          return { bookings: state.added ? [...base, walkin] : base };
        if (u.includes("/api/events/ev1/performer-payments"))
          return {
            payments: [],
            reconciliation: { expected: 0, actual: 0, delta: 0 },
            settledByBooking: {},
          };
        if (u.includes("/api/events")) return { items: EVENTS };
        if (u.includes("/api/performers"))
          return { items: [{ id: "p9", displayName: "Walkin Wendy" }] };
        if (u.includes("/api/membership-captures/parked")) return { parked: [] };
        return { items: [] };
      };
      return { ok: true, status: 200, json };
    }),
  );
}

describe("PaymentsPage — add a last-minute performer (030 US6)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("creates a booking via settlement-performer and shows the new row", async () => {
    const calls: Call[] = [];
    stub(calls, { added: false });
    const user = userEvent.setup();
    render(<PaymentsPage />);
    await screen.findByText("Pat Caller");
    expect(screen.queryByText("Walkin Wendy")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /add a performer/i }));
    const dialog = await screen.findByRole("dialog", { name: /add a performer/i });
    await user.type(within(dialog).getByLabelText(/find performer/i), "Walkin");
    await user.click(within(dialog).getByRole("button", { name: /add walkin wendy/i }));

    await waitFor(() => {
      const post = calls.find(
        (c) => c.url.endsWith("/settlement-performer") && c.method === "POST",
      );
      expect(post).toBeTruthy();
      expect(post!.body).toMatchObject({ performerId: "p9", performerType: "musician" });
    });
    // The new performer now has a row with a check field (outstanding).
    await screen.findByText("Walkin Wendy");
    expect(screen.getByLabelText("Check number for Walkin Wendy")).toBeInTheDocument();
  });
});
