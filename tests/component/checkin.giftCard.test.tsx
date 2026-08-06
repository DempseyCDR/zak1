// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CheckinPage from "@/app/(door)/checkin/page";

// Feature 042 (P6-R10): both named-person check-in paths — the new-contact section and a returning/matched
// candidate row — expose a "Gift card" checkbox that puts `redeemedGiftCard: true` in the attendance POST body,
// independent of Comp. Stubbing fetch is UI-boundary isolation, not the DB-no-mock rule (integration tests only).
type Call = { url: string; init?: RequestInit };

function stub(calls: Call[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      const u = String(url);
      const json = async () => {
        if (u.includes("/api/events"))
          return {
            items: [
              { id: "e1", eventDate: "2020-01-15", seriesId: "s1", startTime: null, label: null },
            ],
          };
        if (u.includes("/api/series")) return { items: [{ id: "s1", key: "tnc", name: "TNC" }] };
        if (u.includes("/api/attendance/search"))
          return {
            items: [
              { id: "p1", displayName: "Bob Fabinski", membershipStatus: "member", emails: [] },
            ],
          };
        if (u.includes("/attendance")) return { attendees: [] };
        return { items: [] };
      };
      return { ok: true, status: 201, json };
    }),
  );
}

function lastAttendancePost(calls: Call[]) {
  return [...calls]
    .reverse()
    .find((c) => c.init?.method === "POST" && c.url.includes("/api/events/e1/attendance"));
}

describe("CheckinPage — gift-card option on the named paths (042)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("records a gift-card redemption when creating a new contact", async () => {
    const calls: Call[] = [];
    stub(calls);
    const user = userEvent.setup();
    render(<CheckinPage />);

    await screen.findByPlaceholderText("Type a name…");
    await user.type(screen.getByPlaceholderText("First name"), "Gia");
    await user.click(screen.getByLabelText("Gift card for new contact"));
    await user.click(screen.getByRole("button", { name: /create \+ check in/i }));

    await waitFor(() => {
      const post = lastAttendancePost(calls);
      expect(post).toBeTruthy();
      const body = JSON.parse(post!.init!.body as string);
      expect(body.newContact).toMatchObject({ firstName: "Gia" });
      expect(body.redeemedGiftCard).toBe(true);
    });
  });

  it("records a gift-card redemption for a returning (matched) contact", async () => {
    const calls: Call[] = [];
    stub(calls);
    const user = userEvent.setup();
    render(<CheckinPage />);

    const searchBox = await screen.findByPlaceholderText("Type a name…");
    await user.type(searchBox, "bob");
    const row = (await screen.findByText("Bob Fabinski")).closest("li")!;

    await user.click(within(row).getByLabelText("Gift card"));
    await user.click(within(row).getByRole("button", { name: /check in/i }));

    await waitFor(() => {
      const post = lastAttendancePost(calls);
      expect(post).toBeTruthy();
      expect(JSON.parse(post!.init!.body as string)).toMatchObject({
        contactId: "p1",
        redeemedGiftCard: true,
      });
    });
  });
});
