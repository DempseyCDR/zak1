// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PaymentsPage from "@/app/(admin)/payments/page";

// Feature 030 (P5-R3) US1: one row per performer; a check number records a payment TO that performer for the
// booked amount (or a typed amount); untouched rows stay outstanding; rows commit independently; a positive
// amount with no check number confirms with a comment (FR-014).
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
  {
    id: "b2",
    performerId: "p2",
    performerName: "Ann Fiddle",
    performerType: "musician",
    payCents: 6000,
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
        if (u.includes("/api/events/ev1/bookings")) return { bookings: BOOKINGS };
        if (u.includes("/api/events/ev1/performer-payments"))
          return {
            payments: [],
            reconciliation: { expected: 210, actual: 0, delta: -210 },
            settledByBooking: { b1: 0, b2: 0 },
          };
        if (u.includes("/api/events")) return { items: EVENTS };
        if (u.includes("/api/performers")) return { items: [] };
        if (u.includes("/api/membership-captures/parked")) return { parked: [] };
        if (u.includes("/api/performer-payments")) return { id: "pay1" };
        return { items: [] };
      };
      return { ok: true, status: 200, json };
    }),
  );
}

const posts = (calls: Call[]) =>
  calls.filter((c) => c.url === "/api/performer-payments" && c.method === "POST");
const row = (name: string) => screen.getByText(name).closest("li") as HTMLElement;

describe("PaymentsPage — per-performer rows (030 US1)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("renders a row per performer with role + booked amount", async () => {
    stub([]);
    render(<PaymentsPage />);
    await screen.findByText("Pat Caller");
    expect(within(row("Pat Caller")).getByText(/caller/)).toBeInTheDocument();
    expect(within(row("Pat Caller")).getByText(/\$150\.00/)).toBeInTheDocument();
    expect(screen.getByText("Ann Fiddle")).toBeInTheDocument();
  });

  it("check# + blank amount records the booked amount to that performer; only that row posts", async () => {
    const calls: Call[] = [];
    stub(calls);
    const user = userEvent.setup();
    render(<PaymentsPage />);
    await screen.findByText("Pat Caller");

    await user.type(screen.getByLabelText("Check number for Pat Caller"), "1001");
    await user.click(within(row("Pat Caller")).getByRole("button", { name: "Record" }));

    await waitFor(() => expect(posts(calls)).toHaveLength(1));
    expect(posts(calls)[0]!.body).toMatchObject({
      eventId: "ev1",
      payeePerformerId: "p1",
      checkNumber: "1001",
      lines: [{ bookingId: "b1", amount: 150 }], // blank → booked
    });
  });

  it("check# + explicit amount records that amount", async () => {
    const calls: Call[] = [];
    stub(calls);
    const user = userEvent.setup();
    render(<PaymentsPage />);
    await screen.findByText("Ann Fiddle");

    await user.type(screen.getByLabelText("Check number for Ann Fiddle"), "1002");
    await user.type(screen.getByLabelText("Amount for Ann Fiddle"), "55");
    await user.click(within(row("Ann Fiddle")).getByRole("button", { name: "Record" }));

    await waitFor(() => expect(posts(calls)).toHaveLength(1));
    expect(posts(calls)[0]!.body).toMatchObject({
      payeePerformerId: "p2",
      lines: [{ bookingId: "b2", amount: 55 }],
    });
  });

  it("an untouched row records nothing", async () => {
    const calls: Call[] = [];
    stub(calls);
    const user = userEvent.setup();
    render(<PaymentsPage />);
    await screen.findByText("Pat Caller");
    await user.click(within(row("Pat Caller")).getByRole("button", { name: "Record" }));
    // give any stray async a tick
    await Promise.resolve();
    expect(posts(calls)).toHaveLength(0);
  });

  it("positive amount + no check# confirms with a comment, then records a check-less payment (FR-014)", async () => {
    const calls: Call[] = [];
    stub(calls);
    const user = userEvent.setup();
    render(<PaymentsPage />);
    await screen.findByText("Pat Caller");

    await user.type(screen.getByLabelText("Amount for Pat Caller"), "80");
    await user.click(within(row("Pat Caller")).getByRole("button", { name: "Record" }));

    // A confirmation dialog with a comment box appears; nothing recorded yet.
    const dialog = await screen.findByRole("dialog", { name: /without a check number/i });
    expect(posts(calls)).toHaveLength(0);
    await user.type(
      within(dialog).getByLabelText(/reason for no check/i),
      "paid cash on the night",
    );
    await user.click(within(dialog).getByRole("button", { name: /record without a check/i }));

    await waitFor(() => expect(posts(calls)).toHaveLength(1));
    const body = posts(calls)[0]!.body as {
      checkNumber?: string;
      overrideReason: string;
      lines: unknown[];
    };
    expect(body.checkNumber).toBeUndefined();
    expect(body.overrideReason).toBe("paid cash on the night");
    expect(body.lines).toEqual([{ bookingId: "b1", amount: 80 }]);
  });
});
