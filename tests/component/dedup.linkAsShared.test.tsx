// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DedupPage from "@/app/(admin)/dedup/page";

afterEach(() => vi.unstubAllGlobals());

type Call = { url: string; init?: RequestInit };

const PAIR = {
  a: {
    id: "c-david",
    displayName: "David Jones",
    membershipStatus: "never",
    phone: null,
    emails: ["shared@jones.com"],
  },
  b: {
    id: "c-bridget",
    displayName: "Bridgit Jones",
    membershipStatus: "never",
    phone: null,
    emails: [] as string[],
  },
  similarity: 0.82,
};

/**
 * `records` maps a contact id to the shape GET /api/contacts/{id} returns — the dedup page reads it to
 * learn the owner's email ID and whether the referrer has an address of its own to retire.
 */
function stub(records: Record<string, unknown>): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      calls.push({ url: u, init });
      const body = (): unknown => {
        if (u.includes("/api/dedup/suggestions")) return { pairs: [PAIR] };
        const hit = Object.keys(records).find((id) => u.endsWith(`/api/contacts/${id}`));
        if (hit) return records[hit];
        return { ok: true };
      };
      return { ok: true, status: 200, json: async () => body() };
    }),
  );
  return calls;
}

const owner = {
  id: "c-david",
  displayName: "David Jones",
  emails: [{ id: "e-david", email: "shared@jones.com", status: "active" }],
};
const referrerNoEmail = { id: "c-bridget", displayName: "Bridgit Jones", emails: [] };
const referrerWithEmail = {
  id: "c-bridget",
  displayName: "Bridgit Jones",
  emails: [{ id: "e-bridget", email: "bridgit-old@example.com", status: "active" }],
};

/**
 * Feature 067 (FR-019): the duplicates queue pairs on NAME similarity and knows nothing about
 * addresses. A same-surname pair is not evidence of a household — Lydia and Richard Dempsey share a
 * surname and must never share an address — so the action must state the address being adopted and
 * confirm before retiring anything.
 */
describe("Dedup page — link as shared is explicit (feature 067)", () => {
  it("names the address the referring contact would adopt, and sends nothing yet (FR-019)", async () => {
    const calls = stub({ "c-david": owner, "c-bridget": referrerNoEmail });
    render(<DedupPage />);
    await screen.findByRole("button", { name: /share David Jones'?s? email/i });

    await userEvent.click(screen.getByRole("button", { name: /share David Jones'?s? email/i }));

    // The address is named in the confirmation before anything is committed.
    const confirm = await screen.findByRole("region", { name: /shared email confirmation/i });
    expect(within(confirm).getByText(/shared@jones\.com/)).toBeInTheDocument();
    expect(calls.some((c) => c.init?.method === "PUT")).toBe(false);
  });

  it("confirming links the referrer to the owner's email (FR-019)", async () => {
    const calls = stub({ "c-david": owner, "c-bridget": referrerNoEmail });
    render(<DedupPage />);
    await screen.findByRole("button", { name: /share David Jones'?s? email/i });

    await userEvent.click(screen.getByRole("button", { name: /share David Jones'?s? email/i }));
    await screen.findByRole("region", { name: /shared email confirmation/i });
    await userEvent.click(screen.getByRole("button", { name: /confirm shared email/i }));

    await waitFor(() => {
      const put = calls.find(
        (c) =>
          c.url.includes("/api/contacts/c-bridget/message-recipient") && c.init?.method === "PUT",
      );
      expect(put).toBeTruthy();
      expect(String(put!.init?.body)).toContain('"emailId":"e-david"');
    });
  });

  it("warns before retiring an address the referrer already owns, then sends retireEmailId (FR-019)", async () => {
    const calls = stub({ "c-david": owner, "c-bridget": referrerWithEmail });
    render(<DedupPage />);
    await screen.findByRole("button", { name: /share David Jones'?s? email/i });

    await userEvent.click(screen.getByRole("button", { name: /share David Jones'?s? email/i }));
    // The confirmation must say what is being given up, naming that address.
    const confirm = await screen.findByRole("region", { name: /shared email confirmation/i });
    expect(within(confirm).getByText(/bridgit-old@example\.com/)).toBeInTheDocument();
    expect(calls.some((c) => c.init?.method === "PUT")).toBe(false);

    await userEvent.click(screen.getByRole("button", { name: /confirm shared email/i }));
    await waitFor(() => {
      const put = calls.find((c) => c.init?.method === "PUT");
      expect(String(put!.init?.body)).toContain('"retireEmailId":"e-bridget"');
    });
  });
});
