// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import PaymentsPage from "@/app/(admin)/payments/page";

// Feature 030 (P5-R3) US2 + FR-016: non-check-requiring bookings (donated / instructor / $0) render FREE with
// no check field; a check-requiring booking already settled by a CROSS-EVENT check (settledByBooking > 0, no
// local payment line) renders paid, not outstanding.
const EVENTS = [
  { id: "ev1", eventDate: "2020-06-15", seriesId: "s1", startTime: "19:30:00", label: "TNC" },
];
const BOOKINGS = [
  {
    id: "b1",
    performerId: "p1",
    performerName: "Donna Donor",
    performerType: "musician",
    payCents: 0,
    requiresCheck: false,
    isDonated: true,
  },
  {
    id: "b2",
    performerId: "p2",
    performerName: "Ivan Instructor",
    performerType: "instructor",
    payCents: 0,
    requiresCheck: false,
    isDonated: false,
  },
  {
    id: "b3",
    performerId: "p3",
    performerName: "Zed Zero",
    performerType: "musician",
    payCents: 0,
    requiresCheck: false,
    isDonated: false,
  },
  {
    id: "b4",
    performerId: "p4",
    performerName: "Xavier Crossevent",
    performerType: "musician",
    payCents: 12500,
    requiresCheck: true,
    isDonated: false,
  },
  {
    id: "b5",
    performerId: "p5",
    performerName: "Owen Outstanding",
    performerType: "musician",
    payCents: 6000,
    requiresCheck: true,
    isDonated: false,
  },
];

function stub() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const u = String(url);
      const json = async () => {
        if (u.includes("/api/series")) return { items: [{ id: "s1", key: "tnc", name: "TNC" }] };
        if (u.includes("/api/events/ev1/bookings")) return { bookings: BOOKINGS };
        if (u.includes("/api/events/ev1/performer-payments"))
          // b4 is settled by a check recorded elsewhere → in settledByBooking but NOT in this event's payments.
          return {
            payments: [],
            reconciliation: { expected: 185, actual: 125, delta: -60 },
            settledByBooking: { b4: 125, b5: 0 },
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

const row = (name: string) => screen.getByText(name).closest("li") as HTMLElement;

describe("PaymentsPage — free rows + cross-event settled (030 US2 / FR-016)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("renders donated / instructor / $0 as free with no check field", async () => {
    stub();
    render(<PaymentsPage />);
    await screen.findByText("Donna Donor");

    // Free rows: no per-row check-number input.
    expect(screen.queryByLabelText("Check number for Donna Donor")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Check number for Ivan Instructor")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Check number for Zed Zero")).not.toBeInTheDocument();
    // Donated is labelled as such; the others read free.
    expect(row("Donna Donor")).toHaveTextContent(/donated/i);
    expect(row("Ivan Instructor")).toHaveTextContent(/free/i);
  });

  it("a cross-event-settled booking shows paid, not outstanding (FR-016)", async () => {
    stub();
    render(<PaymentsPage />);
    await screen.findByText("Xavier Crossevent");

    expect(row("Xavier Crossevent")).toHaveTextContent(/recorded at another event/i);
    expect(screen.queryByLabelText("Check number for Xavier Crossevent")).not.toBeInTheDocument();
  });

  it("a genuinely unpaid check-requiring booking is still outstanding (has a check field)", async () => {
    stub();
    render(<PaymentsPage />);
    await screen.findByText("Owen Outstanding");
    expect(screen.getByLabelText("Check number for Owen Outstanding")).toBeInTheDocument();
  });
});
