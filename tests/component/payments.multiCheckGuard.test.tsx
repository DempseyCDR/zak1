// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PaymentsPage from "@/app/(admin)/payments/page";

// Feature 043 (D3): the multi-apply popup can't save a positive check with neither a number nor a comment
// (the FR-014 guard the single-row path enforces); a multi-line payment's check number is editable in place.
type Call = { url: string; method: string; body: unknown };
const EVENTS = [
  { id: "ev1", eventDate: "2020-06-15", seriesId: "s1", startTime: "19:30:00", label: "TNC" },
];
const B1 = {
  id: "b1",
  performerId: "p1",
  performerName: "Clara Lead",
  performerType: "lead_musician",
  payCents: 5000,
  requiresCheck: true,
  isDonated: false,
};
const B2 = {
  id: "b2",
  performerId: "p2",
  performerName: "Micah Lead",
  performerType: "lead_musician",
  payCents: 5000,
  requiresCheck: true,
  isDonated: false,
};

function stub(calls: Call[], payments: unknown[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ url: u, method, body });
      const json = async () => {
        if (u.includes("/api/series")) return { items: [{ id: "s1", key: "tnc", name: "TNC" }] };
        if (u.includes("/api/events/ev1/bookings")) return { bookings: [B1, B2] };
        if (u.includes("/api/events/ev1/performer-payments"))
          return {
            payments,
            reconciliation: { expected: 0, actual: 0, delta: 0 },
            settledByBooking: {},
          };
        if (u.includes("/api/events")) return { items: EVENTS };
        if (u.includes("/api/performers"))
          return {
            items: [
              { id: "p1", displayName: "Clara Lead" },
              { id: "p2", displayName: "Micah Lead" },
            ],
          };
        if (u.includes("/api/membership-captures/parked")) return { parked: [] };
        return { items: [] };
      };
      return { ok: true, status: 200, json };
    }),
  );
}

describe("PaymentsPage — multi-booking check guard + editable number (043 D3)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("blocks a positive multi-check with no number until a comment is entered", async () => {
    const calls: Call[] = [];
    stub(calls, []);
    const user = userEvent.setup();
    render(<PaymentsPage />);
    await screen.findByText("Clara Lead");

    await user.click(
      screen.getByRole("button", { name: /apply one check to multiple performers/i }),
    );
    const dialog = await screen.findByRole("dialog", { name: /apply one check to multiple/i });
    await user.selectOptions(within(dialog).getByLabelText("Payee"), "p1");
    // check both bookings (positive total), leave check# + note blank
    for (const cb of within(dialog).getAllByRole("checkbox")) await user.click(cb);
    await user.click(within(dialog).getByRole("button", { name: /record check/i }));

    // blocked: no create POST, and an error/prompt is shown
    expect(
      calls.find((c) => c.url.endsWith("/api/performer-payments") && c.method === "POST"),
    ).toBeFalsy();
    expect(screen.getByRole("alert")).toBeInTheDocument();

    // adding a comment (note) lets it save — posts overrideReason, no checkNumber
    await user.type(within(dialog).getByLabelText(/note/i), "cash, no check written");
    await user.click(within(dialog).getByRole("button", { name: /record check/i }));
    await waitFor(() => {
      const post = calls.find(
        (c) => c.url.endsWith("/api/performer-payments") && c.method === "POST",
      );
      expect(post).toBeTruthy();
      expect(post!.body).toMatchObject({ overrideReason: "cash, no check written" });
      expect((post!.body as { checkNumber?: string }).checkNumber).toBeUndefined();
    });
  });

  it("edits the check number on a multi-line payment in place (no lines in the PATCH)", async () => {
    const calls: Call[] = [];
    const multi = {
      id: "pay1",
      payee: "Clara Lead",
      amount: 100,
      checkNumber: null,
      overrideReason: null,
      voided: false,
      voidReason: null,
      lines: [
        { bookingId: "b1", amount: 50 },
        { bookingId: "b2", amount: 50 },
      ],
    };
    stub(calls, [multi]);
    const user = userEvent.setup();
    render(<PaymentsPage />);
    await screen.findByText("Clara Lead");

    await user.click(await screen.findByRole("button", { name: /edit check ?#/i }));
    await user.type(screen.getByLabelText(/new check number/i), "1792");
    await user.click(screen.getByRole("button", { name: /save check/i }));

    await waitFor(() => {
      const patch = calls.find(
        (c) => c.url.includes("/api/performer-payments/pay1") && c.method === "PATCH",
      );
      expect(patch).toBeTruthy();
      expect(patch!.body).toMatchObject({ checkNumber: "1792" });
      expect((patch!.body as { lines?: unknown }).lines).toBeUndefined();
    });
  });
});
