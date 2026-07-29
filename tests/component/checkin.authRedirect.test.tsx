// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CheckinPage from "@/app/(door)/checkin/page";

// Feature 022 (B41), SC-004: an expired session on the door check-in search must SEND THE ATTENDANT TO SIGN
// IN — never silently render a "no match" over a real person (the reproduced defect). Mount fetches succeed
// (empty); the search endpoint returns 401 → apiFetch redirects to /login?next=/checkin.

type MockLoc = { href: string; sets: number };
function mockLocation(pathname: string): MockLoc {
  const rec: MockLoc = { href: "", sets: 0 };
  const loc = {
    pathname,
    search: "",
    get href() {
      return rec.href;
    },
    set href(v: string) {
      rec.href = v;
      rec.sets++;
    },
  };
  Object.defineProperty(window, "location", { value: loc, configurable: true });
  return rec;
}

const realLocation = window.location;
afterEach(() => {
  vi.unstubAllGlobals();
  Object.defineProperty(window, "location", { value: realLocation, configurable: true });
});

describe("check-in search under an expired session (B41)", () => {
  it("redirects to /login?next=/checkin instead of rendering a silent 'no match'", async () => {
    const loc = mockLocation("/checkin");
    // Mount data loads succeed (empty); only the attendance search is unauthenticated.
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).includes("/api/attendance/search")) {
          return {
            status: 401,
            ok: false,
            json: async () => ({ error: { code: "UNAUTHENTICATED" } }),
          };
        }
        return { status: 200, ok: true, json: async () => ({ items: [] }) };
      }),
    );

    render(<CheckinPage />);
    await userEvent.type(screen.getByPlaceholderText("Type a name…"), "alex");

    await waitFor(() => expect(loc.sets).toBe(1));
    expect(loc.href).toBe(`/login?next=${encodeURIComponent("/checkin")}`);
    // The search never rendered candidates: no "Check in" button appeared.
    expect(screen.queryByRole("button", { name: "Check in" })).toBeNull();
  });
});
