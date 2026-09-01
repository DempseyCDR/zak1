// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ContactsPage from "@/app/(admin)/contacts/page";

// Feature 060 (FR-010 / SC-004): migrating the contacts surface to the mobile-first shell/patterns must
// NOT change behavior — search still lists matches and the create form still POSTs. Presentation only.
afterEach(() => vi.unstubAllGlobals());

function stubFetch(items: unknown[]): { url: string; init?: RequestInit }[] {
  const calls: { url: string; init?: RequestInit }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      if (init?.method === "POST") {
        return { status: 201, ok: true, json: async () => ({ id: "new" }) };
      }
      return { status: 200, ok: true, json: async () => ({ items }) };
    }),
  );
  return calls;
}

describe("contacts page (no behavior regression)", () => {
  it("lists search matches", async () => {
    stubFetch([
      {
        id: "1",
        displayName: "Ada Lovelace",
        membershipStatus: "current",
        listMember: true,
        pronouns: "she/her",
      },
    ]);
    render(<ContactsPage />);
    await userEvent.type(screen.getByPlaceholderText(/search by name/i), "ada");
    await waitFor(() => expect(screen.getByText(/Ada Lovelace/)).toBeInTheDocument());
  });

  it("submits the create form as a POST to /api/contacts", async () => {
    const calls = stubFetch([]);
    render(<ContactsPage />);
    await userEvent.type(screen.getByPlaceholderText("First name"), "Grace");
    await userEvent.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() =>
      expect(calls.some((c) => c.url.includes("/api/contacts") && c.init?.method === "POST")).toBe(
        true,
      ),
    );
  });
});
