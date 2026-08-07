// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PaymentsPage from "@/app/(admin)/payments/page";

// Feature 043 (P6-R12): the payments page gains a substitute control (pick a booking + find a substitute
// performer) that POSTs to /api/bookings/[id]/substitute — the FS's substitution surface moved here.
type Call = { url: string; method: string; body: unknown };
const EVENTS = [
  { id: "ev1", eventDate: "2020-06-15", seriesId: "s1", startTime: "19:30:00", label: "TNC" },
];
const BOOKINGS = [
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

function stub(calls: Call[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ url: u, method, body });
      const json = async () => {
        if (u.includes("/api/series")) return { items: [{ id: "s1", key: "tnc", name: "TNC" }] };
        if (u.includes("/substitute") && method === "POST") return { id: "b2" };
        if (u.includes("/api/events/ev1/bookings")) return { bookings: BOOKINGS };
        if (u.includes("/api/events/ev1/performer-payments"))
          return {
            payments: [],
            reconciliation: { expected: 0, actual: 0, delta: 0 },
            settledByBooking: {},
          };
        if (u.includes("/api/events")) return { items: EVENTS };
        if (u.includes("/api/performers"))
          return { items: [{ id: "p9", displayName: "Sub Player" }] };
        if (u.includes("/api/membership-captures/parked")) return { parked: [] };
        return { items: [] };
      };
      return { ok: true, status: 200, json };
    }),
  );
}

describe("PaymentsPage — substitute a performer (043 R12)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("posts to the substitute route with the chosen booking + substitute performer", async () => {
    const calls: Call[] = [];
    stub(calls);
    const user = userEvent.setup();
    render(<PaymentsPage />);
    await screen.findByText("Pat Caller");

    await user.click(screen.getByRole("button", { name: /substitute a performer/i }));
    const dialog = await screen.findByRole("dialog", { name: /substitute a performer/i });
    // choose the booking to substitute
    await user.selectOptions(within(dialog).getByLabelText(/booking to substitute/i), "b1");
    await user.type(within(dialog).getByLabelText(/find substitute/i), "Sub");
    await user.click(within(dialog).getByRole("button", { name: /sub player/i }));

    await waitFor(() => {
      const post = calls.find(
        (c) => c.url.includes("/api/bookings/b1/substitute") && c.method === "POST",
      );
      expect(post).toBeTruthy();
      expect(post!.body).toMatchObject({ newPerformerId: "p9" });
    });
  });
});
