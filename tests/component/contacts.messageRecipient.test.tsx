// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MessageRecipient from "@/app/(admin)/contacts/_components/MessageRecipient";

afterEach(() => vi.unstubAllGlobals());

type Call = { url: string; init?: RequestInit };
function stub(): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    }),
  );
  return calls;
}

const recipient = {
  emailId: "e-david",
  address: "shared@jones.com",
  ownerContactId: "c-david",
  ownerDisplayName: "David Jones",
};

const renderRef = (over: Partial<React.ComponentProps<typeof MessageRecipient>> = {}) =>
  render(
    <MessageRecipient
      contactId="c-bridget"
      messageRecipient={recipient}
      sharedWith={[]}
      hasOwnActiveEmail={false}
      canWrite
      onChanged={() => {}}
      {...over}
    />,
  );

// Feature 067 (FR-009): a referrer rides the owner's address and holds no consent of her own.
describe("MessageRecipient — referrer view (feature 067)", () => {
  it("shows the shared address read-only, naming the owner (FR-009)", () => {
    renderRef();
    // The name is emphasised, so the sentence spans elements — assert on the section's text.
    const section = screen.getByRole("region", { name: /shared email/i });
    expect(section.textContent).toMatch(/reached via David Jones/i);
    expect(screen.getByText(/shared@jones\.com/)).toBeInTheDocument();
    // No editable email row and no consent controls belong to a referrer.
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("withholds the address gracefully when PII is redacted (FR-016)", () => {
    renderRef({ messageRecipient: { ...recipient, address: null } });
    // The owner's name still makes the record comprehensible.
    const section = screen.getByRole("region", { name: /shared email/i });
    expect(section.textContent).toMatch(/reached via David Jones/i);
    expect(screen.queryByText(/shared@jones\.com/)).toBeNull();
  });

  it("unlink issues DELETE (FR-015)", async () => {
    const calls = stub();
    renderRef();
    await userEvent.click(screen.getByRole("button", { name: /stop sharing/i }));
    await waitFor(() =>
      expect(
        calls.some(
          (c) =>
            c.url.includes("/api/contacts/c-bridget/message-recipient") &&
            c.init?.method === "DELETE",
        ),
      ).toBe(true),
    );
  });

  it("hides the unlink action without mailing-write (FR-002)", () => {
    renderRef({ canWrite: false });
    expect(screen.queryByRole("button", { name: /stop sharing/i })).toBeNull();
  });
});

// Feature 067 (FR-010c): the app is the only place the household roster is visible.
describe("MessageRecipient — owner view (feature 067)", () => {
  it("lists the contacts riding this contact's address", () => {
    render(
      <MessageRecipient
        contactId="c-david"
        messageRecipient={null}
        sharedWith={[{ contactId: "c-bridget", displayName: "Bridget Jones" }]}
        hasOwnActiveEmail
        canWrite
        onChanged={() => {}}
      />,
    );
    expect(screen.getByText(/also reached at this address/i)).toBeInTheDocument();
    expect(screen.getByText(/Bridget Jones/)).toBeInTheDocument();
  });

  it("renders nothing when the contact neither shares nor is shared with", () => {
    const { container } = render(
      <MessageRecipient
        contactId="c-solo"
        messageRecipient={null}
        sharedWith={[]}
        hasOwnActiveEmail
        canWrite
        onChanged={() => {}}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

/**
 * Feature 067 (FR-020): an active owned email WINS over a reference, matching the export resolver — so
 * the record can never say "reached via David" while mail actually goes to her own address.
 */
describe("MessageRecipient — owned address wins over a stale pointer (feature 067)", () => {
  it("shows her own address, not the owner's, and offers to clear the stale link", async () => {
    const calls = stub();
    renderRef({ hasOwnActiveEmail: true });

    const section = screen.getByRole("region", { name: /shared email/i });
    expect(section.textContent).not.toMatch(/reached via David Jones/i);
    expect(section.textContent).toMatch(/reached at their own address/i);

    await userEvent.click(screen.getByRole("button", { name: /clear/i }));
    await waitFor(() => expect(calls.some((c) => c.init?.method === "DELETE")).toBe(true));
  });
});
