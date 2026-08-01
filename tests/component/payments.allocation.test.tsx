// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PaymentsPage from "@/app/(admin)/payments/page";

// Feature 023 US1/US3: the payments page records a check with PER-LINE amounts and can VOID a check. Over a
// stubbed fetch (UI-boundary isolation; the API behaviour is covered by node integration tests).
function json(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body } as Response;
}

const calls: { url: string; method: string; body: unknown }[] = [];
function stub() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ url: u, method, body });
      if (u.includes("/bookings"))
        return json({
          bookings: [
            { id: "bk1", performerName: "Pat", performerType: "musician", payCents: 12500 },
          ],
        });
      if (u.includes("/performer-payments/") && u.endsWith("/void"))
        return json({ id: "pay1", voided: true });
      if (u.includes("/performer-payments") && method === "POST") return json({ id: "pay1" }, 201);
      if (u.includes("/performer-payments"))
        return json({
          payments: [
            {
              id: "pay1",
              payee: "Pat",
              amount: 125,
              checkNumber: "1",
              overrideReason: null,
              voided: false,
              voidReason: null,
              lines: [{ bookingId: "bk1", amount: 125 }],
            },
          ],
          reconciliation: { expected: 125, actual: 125, delta: 0 },
        });
      if (u.includes("/api/performers"))
        return json({ items: [{ id: "perf1", displayName: "Pat" }] });
      if (u.includes("/api/events"))
        return json({ items: [{ id: "ev1", eventDate: "2026-06-18" }] });
      return json({});
    }),
  );
}

describe("PaymentsPage — per-line allocation + void (023)", () => {
  beforeEach(() => {
    calls.length = 0;
    stub();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("records a check with a per-line amount, and voids an existing check", async () => {
    render(<PaymentsPage />);
    // Feature 028: the shared EventSelector drives loadEvent — selecting the event loads its
    // bookings/payments (the payments-surface side effect, T013).
    await userEvent.selectOptions(await screen.findByRole("combobox", { name: /^event$/i }), "ev1");
    await screen.findByText(/booked \$125\.00/);
    expect(calls.some((c) => c.url.includes("/events/ev1/bookings"))).toBe(true);

    // Pick the payee, put the booking on the check (seeds its amount), record.
    const payeeSelect = screen.getByRole("combobox", { name: /payee/i });
    await userEvent.selectOptions(payeeSelect, "perf1");
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: "Record check" }));

    await waitFor(() => {
      const post = calls.find((c) => c.url === "/api/performer-payments" && c.method === "POST");
      expect(post).toBeTruthy();
      expect(post!.body).toMatchObject({
        eventId: "ev1",
        payeePerformerId: "perf1",
        lines: [{ bookingId: "bk1", amount: 125 }],
      });
    });

    // Void the existing recorded check.
    await userEvent.click(screen.getByRole("button", { name: "Void" }));
    await waitFor(() =>
      expect(
        calls.some((c) => c.url.endsWith("/performer-payments/pay1/void") && c.method === "POST"),
      ).toBe(true),
    );
  });
});
