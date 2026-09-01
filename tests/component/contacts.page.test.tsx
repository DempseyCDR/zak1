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

// Feature 062 (M-R3/M-R4): two-section results (single contacts + potential-duplicate pairs) and
// focus-to-search.
function stubSections(opts: {
  items?: unknown[];
  pairs?: unknown[];
}): { url: string; init?: RequestInit }[] {
  const calls: { url: string; init?: RequestInit }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      if (init?.method === "POST") return { status: 200, ok: true, json: async () => ({}) };
      if (String(url).includes("/api/dedup/suggestions"))
        return { status: 200, ok: true, json: async () => ({ pairs: opts.pairs ?? [] }) };
      return { status: 200, ok: true, json: async () => ({ items: opts.items ?? [] }) };
    }),
  );
  return calls;
}

const dupContact = (id: string, name: string) => ({
  id,
  displayName: name,
  membershipStatus: "never",
  phone: null,
  emails: [],
});

describe("contacts page — duplicates section + focus (feature 062)", () => {
  it("renders both sections: single contacts and potential-duplicate pairs (C5)", async () => {
    stubSections({
      items: [dupContact("1", "Jon Smith")],
      pairs: [
        { a: dupContact("1", "Jon Smith"), b: dupContact("2", "John Smith"), similarity: 0.9 },
      ],
    });
    render(<ContactsPage />);
    await userEvent.type(screen.getByPlaceholderText(/search by name/i), "smith");
    // The single-contacts section (TriageList) and the potential-duplicates section both render.
    await waitFor(() => expect(screen.getByText(/Potential duplicates/i)).toBeInTheDocument());
    expect(screen.getByText("Jon Smith ↔ John Smith")).toBeInTheDocument();
  });

  it("omits the duplicates section when there are no pairs (C7)", async () => {
    stubSections({ items: [dupContact("1", "Ada Lovelace")], pairs: [] });
    render(<ContactsPage />);
    await userEvent.type(screen.getByPlaceholderText(/search by name/i), "ada");
    await waitFor(() => expect(screen.getByText(/Ada Lovelace/)).toBeInTheDocument());
    expect(screen.queryByText(/Potential duplicates/i)).toBeNull();
  });

  it("merges a selected pair via POST /api/dedup/merge (C6)", async () => {
    const calls = stubSections({
      pairs: [
        { a: dupContact("a1", "Jon Smith"), b: dupContact("b1", "John Smith"), similarity: 0.9 },
      ],
    });
    render(<ContactsPage />);
    await userEvent.type(screen.getByPlaceholderText(/search by name/i), "smith");
    await waitFor(() => expect(screen.getByText(/Potential duplicates/i)).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /keep jon smith/i }));
    await waitFor(() =>
      expect(
        calls.some(
          (c) =>
            c.url.includes("/api/dedup/merge") &&
            c.init?.method === "POST" &&
            String(c.init?.body).includes('"canonicalId":"a1"') &&
            String(c.init?.body).includes('"mergedId":"b1"'),
        ),
      ).toBe(true),
    );
  });

  it("auto-focuses the search field on load (C9)", async () => {
    stubSections({});
    render(<ContactsPage />);
    await waitFor(() => expect(screen.getByPlaceholderText(/search by name/i)).toHaveFocus());
  });
});
