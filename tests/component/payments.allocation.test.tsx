// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PaymentsPage from "@/app/(admin)/payments/page";

// Feature 023 US1/US3, re-presented by feature 030 US4: the one-check-many-bookings path now lives in a
// MULTI-APPLY POPUP (a single payee settling several bookings), and a recorded check is still voided. Over a
// stubbed fetch (UI-boundary isolation; the API behaviour is covered by node integration tests).
const calls: { url: string; method: string; body: unknown }[] = [];
function stub() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ url: u, method, body });
      const json = async () => {
        if (u.includes("/api/series")) return { items: [{ id: "s1", key: "tnc", name: "TNC" }] };
        if (u.includes("/void")) return { id: "pay1", voided: true };
        if (u.includes("/events/ev1/performer-payments"))
          return {
            payments: [
              {
                id: "pay1",
                payee: "Dana",
                amount: 60,
                checkNumber: "9",
                overrideReason: null,
                voided: false,
                voidReason: null,
                lines: [{ bookingId: "bk2", amount: 60 }],
              },
            ],
            reconciliation: { expected: 185, actual: 60, delta: -125 },
            settledByBooking: { bk1: 0, bk2: 60 },
          };
        if (u === "/api/performer-payments" && method === "POST") return { id: "pay2" };
        if (u.includes("/events/ev1/bookings"))
          return {
            bookings: [
              {
                id: "bk1",
                performerId: "perf1",
                performerName: "Pat",
                performerType: "musician",
                payCents: 12500,
                requiresCheck: true,
                isDonated: false,
              },
              {
                id: "bk2",
                performerId: "perf2",
                performerName: "Dana",
                performerType: "musician",
                payCents: 6000,
                requiresCheck: true,
                isDonated: false,
              },
            ],
          };
        if (u.includes("/api/events"))
          return {
            items: [
              { id: "ev1", eventDate: "2026-06-18", seriesId: "s1", startTime: null, label: null },
            ],
          };
        if (u.includes("/api/performers"))
          return {
            items: [
              { id: "perf1", displayName: "Pat" },
              { id: "perf2", displayName: "Dana" },
            ],
          };
        if (u.includes("/membership-captures/parked")) return { parked: [] };
        return { items: [] };
      };
      return { ok: true, status: 200, json };
    }),
  );
}

describe("PaymentsPage — multi-apply popup + void (030 US4)", () => {
  beforeEach(() => {
    calls.length = 0;
    stub();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("records a shared check to one payee across a booking via the popup, and voids an existing check", async () => {
    const user = userEvent.setup();
    render(<PaymentsPage />);
    await screen.findByText("Pat"); // auto-selected event's rows loaded

    await user.click(
      screen.getByRole("button", { name: /apply one check to multiple performers/i }),
    );
    const dialog = await screen.findByRole("dialog", { name: /one check to multiple bookings/i });
    await user.selectOptions(within(dialog).getByLabelText("Payee"), "perf1");
    const patLabel = within(dialog)
      .getByText(/Pat \(musician\)/)
      .closest("label") as HTMLElement;
    await user.click(within(patLabel).getByRole("checkbox"));
    await user.click(within(dialog).getByRole("button", { name: "Record check" }));

    await waitFor(() => {
      const post = calls.find((c) => c.url === "/api/performer-payments" && c.method === "POST");
      expect(post).toBeTruthy();
      expect(post!.body).toMatchObject({
        eventId: "ev1",
        payeePerformerId: "perf1",
        lines: [{ bookingId: "bk1", amount: 125 }],
      });
    });

    // The popup closed on success; void the existing check on Dana's paid row.
    const danaRow = screen.getByText("Dana").closest("li") as HTMLElement;
    await user.click(within(danaRow).getByRole("button", { name: "Void" }));
    await waitFor(() =>
      expect(
        calls.some((c) => c.url.endsWith("/performer-payments/pay1/void") && c.method === "POST"),
      ).toBe(true),
    );
  });
});
