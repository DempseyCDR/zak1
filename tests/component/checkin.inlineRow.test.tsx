// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CheckinPage from "@/app/(door)/checkin/page";

// Feature 025 US3 (FR-014/015/016): comp + children + confirm are inline on each candidate row (incl. the
// anonymous path), and focus returns to the search box after a confirmed check-in.
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

describe("CheckinPage — inline row check-in", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("checks in a candidate with inline children, then returns focus to search", async () => {
    const calls: Call[] = [];
    stub(calls);
    const user = userEvent.setup();
    render(<CheckinPage />);

    const searchBox = await screen.findByPlaceholderText("Type a name…");
    await user.type(searchBox, "bob");
    const row = (await screen.findByText("Bob Fabinski")).closest("li")!;

    await user.type(within(row).getByLabelText(/children/i), "1");
    await within(row).findByRole("button", { name: /check in/i });
    await user.click(within(row).getByRole("button", { name: /check in/i }));

    await waitFor(() => {
      const post = calls.find(
        (c) => c.init?.method === "POST" && c.url.includes("/api/events/e1/attendance"),
      );
      expect(post).toBeTruthy();
      expect(JSON.parse(post!.init!.body as string)).toMatchObject({
        contactId: "p1",
        childrenCount: 1,
      });
    });

    // FR-016: focus is back on the search box for the next dancer.
    await waitFor(() => expect(document.activeElement).toBe(searchBox));
  });

  it("carries children on the anonymous (unmatched) admission", async () => {
    const calls: Call[] = [];
    stub(calls);
    const user = userEvent.setup();
    render(<CheckinPage />);

    await screen.findByPlaceholderText("Type a name…");
    await user.type(screen.getByLabelText(/children on unmatched/i), "2");
    await user.click(screen.getByRole("button", { name: /declined \/ unmatched/i }));

    await waitFor(() => {
      const post = calls.find(
        (c) => c.init?.method === "POST" && c.url.includes("/api/events/e1/attendance"),
      );
      expect(JSON.parse(post!.init!.body as string)).toMatchObject({
        unmatched: true,
        childrenCount: 2,
      });
    });
  });
});
