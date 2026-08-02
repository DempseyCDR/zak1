// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PaymentsPage from "@/app/(admin)/payments/page";

// Feature 030 (P5-R3) US5: clicking a paid row edits its amount + check number in place (PATCH); the void
// action remains available.
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
const PAYMENTS = [
  {
    id: "pay1",
    payee: "Pat Caller",
    amount: 150,
    checkNumber: "1001",
    overrideReason: null,
    voided: false,
    voidReason: null,
    lines: [{ bookingId: "b1", amount: 150 }],
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
            payments: PAYMENTS,
            reconciliation: { expected: 150, actual: 150, delta: 0 },
            settledByBooking: { b1: 150 },
          };
        if (u.includes("/api/events")) return { items: EVENTS };
        if (u.includes("/api/performers")) return { items: [] };
        if (u.includes("/api/membership-captures/parked")) return { parked: [] };
        if (u.includes("/api/performer-payments/pay1")) return { id: "pay1" };
        return { items: [] };
      };
      return { ok: true, status: 200, json };
    }),
  );
}

const row = () => screen.getByText("Pat Caller").closest("li") as HTMLElement;

describe("PaymentsPage — inline edit a paid row (030 US5)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("edits amount + check number in place via PATCH; void remains available", async () => {
    const calls: Call[] = [];
    stub(calls);
    const user = userEvent.setup();
    render(<PaymentsPage />);
    await screen.findByText("Pat Caller");

    // Paid row shows the amount and offers Void.
    expect(within(row()).getByText(/\$150\.00/)).toBeInTheDocument();
    expect(within(row()).getByRole("button", { name: "Void" })).toBeInTheDocument();

    await user.click(within(row()).getByRole("button", { name: "Edit" }));
    const amount = screen.getByLabelText("Edit amount for Pat Caller");
    await user.clear(amount);
    await user.type(amount, "140");
    const check = screen.getByLabelText("Edit check number for Pat Caller");
    await user.clear(check);
    await user.type(check, "2002");
    await user.click(within(row()).getByRole("button", { name: "Save" }));

    await waitFor(() => {
      const patch = calls.find(
        (c) => c.url.endsWith("/performer-payments/pay1") && c.method === "PATCH",
      );
      expect(patch).toBeTruthy();
      expect(patch!.body).toMatchObject({
        checkNumber: "2002",
        lines: [{ bookingId: "b1", amount: 140 }],
      });
    });
  });
});
