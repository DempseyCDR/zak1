// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BookingsReportPage from "@/app/(admin)/bookings-report/page";
import { BookingModal } from "@/app/(admin)/_modals/BookingModal";

// Feature 024 US2/US3 (component, jsdom, stubbed fetch): the report exposes a band re-point control that
// POSTs repoint-band; the modal exposes a substitute action that POSTs substitute; a re-point refused as
// paid surfaces the server's inline "settled by a live check" message.
type Call = { url: string; init?: RequestInit };

const ROW = {
  eventId: "e1",
  date: "2026-06-18",
  series: "Thursday Night Contra",
  venueShortName: "GH",
  hasSoundTech: false,
  caller: null,
  band: "Band A",
  bandId: "bandA",
  musicians: ["Ann"],
  soundTech: null,
  cancelled: false,
  bookings: [
    { bookingId: "b2", performerId: "p2", performer: "Ann", type: "musician", status: "confirmed" },
  ],
};

const BANDS = [
  { id: "bandA", name: "Band A" },
  { id: "bandB", name: "Band B" },
];

describe("BookingsReportPage — band re-point", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("offers a re-point control and POSTs repoint-band with from/to band ids", async () => {
    const calls: Call[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url, init });
        const json = async () => {
          if (url.includes("/api/me/capabilities")) return { bookingWrite: true, eventWrite: true };
          if (url.includes("/api/bookings/report")) return { rows: [ROW] };
          if (url.includes("/api/bands")) return { items: BANDS };
          return { items: [] };
        };
        return { ok: true, status: 201, json };
      }),
    );
    const user = userEvent.setup();
    render(<BookingsReportPage />);

    await waitFor(() => screen.getByText("GH"));
    const row = screen.getByText("GH").closest("tr")!;
    const select = within(row).getByLabelText(/re-point band to/i);
    await user.selectOptions(select, "bandB");
    await user.click(within(row).getByRole("button", { name: /re-point band/i }));

    await waitFor(() =>
      expect(
        calls.some((c) => c.init?.method === "POST" && c.url.includes("/events/e1/repoint-band")),
      ).toBe(true),
    );
    const post = calls.find((c) => c.url.includes("/repoint-band"))!;
    expect(JSON.parse(post.init!.body as string)).toEqual({
      fromBandId: "bandA",
      toBandId: "bandB",
    });
  });
});

const BOOKING = {
  id: "b1",
  performerId: "p1",
  performer: "Booked Bo",
  type: "musician",
  payCents: 12500,
  note: null,
  status: "confirmed",
};

describe("BookingModal — substitute + paid refusal", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("substitutes a performer via the substitute endpoint", async () => {
    const calls: Call[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url, init });
        const json = async () =>
          url.includes("/api/performers?q=")
            ? { items: [{ id: "sub9", displayName: "Sub Sue" }] }
            : {};
        return { ok: true, status: 200, json };
      }),
    );
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(
      <BookingModal
        mode="edit"
        eventId="e1"
        eventDate="2026-06-18"
        booking={BOOKING}
        onClose={() => {}}
        onSaved={onSaved}
      />,
    );

    await user.type(screen.getByLabelText(/substitute performer/i), "sue");
    await waitFor(() => screen.getByRole("button", { name: /Substitute in Sub Sue/ }));
    await user.click(screen.getByRole("button", { name: /Substitute in Sub Sue/ }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const post = calls.find(
      (c) => c.init?.method === "POST" && c.url.includes("/api/bookings/b1/substitute"),
    )!;
    expect(post).toBeTruthy();
    expect(JSON.parse(post.init!.body as string)).toEqual({ newPerformerId: "sub9" });
  });

  it("surfaces the paid-refusal message inline when a re-point Save is refused (422)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === "PATCH") {
          return {
            ok: false,
            status: 422,
            json: async () => ({
              error: {
                code: "VALIDATION_ERROR",
                message:
                  "This booking is settled by a live check — void it first, or substitute the performer.",
              },
            }),
          };
        }
        return { ok: true, status: 200, json: async () => ({}) };
      }),
    );
    const user = userEvent.setup();
    render(
      <BookingModal
        mode="edit"
        eventId="e1"
        eventDate="2026-06-18"
        booking={BOOKING}
        onClose={() => {}}
        onSaved={() => {}}
      />,
    );

    await user.click(screen.getByRole("button", { name: /^Save$/ }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/settled by a live check/i),
    );
  });
});
