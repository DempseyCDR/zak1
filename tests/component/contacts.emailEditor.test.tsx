// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EmailEditor, { type EmailRow } from "@/app/(admin)/contacts/_components/EmailEditor";

afterEach(() => vi.unstubAllGlobals());

const email = (over: Partial<EmailRow> = {}): EmailRow => ({
  id: "e1",
  email: "a@x.com",
  purposes: ["personal"],
  consentTopics: ["contra"],
  status: "active",
  isLogin: false,
  providerLastOpen: null,
  providerLastClick: null,
  providerSetDate: null,
  ...over,
});

type Call = { url: string; init?: RequestInit };
const json = (body: unknown, status = 200) => ({
  ok: status < 400,
  status,
  json: async () => body,
});

function stub(opts: { collision?: { contactId: string; displayName: string } } = {}): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      const method = init?.method ?? "GET";
      if (method === "PATCH" && opts.collision)
        return json({ error: { code: "EMAIL_ACTIVE_ELSEWHERE", other: opts.collision } }, 409);
      return json({ ok: true });
    }),
  );
  return calls;
}

const row = (addr = "a@x.com") =>
  within(screen.getByRole("listitem", { name: new RegExp(`Email ${addr}`) }));
const render1 = (over: Partial<EmailRow> = {}, caps = { canDeleteUnrestricted: false }) =>
  render(
    <EmailEditor
      contactId="c1"
      emails={[email(over)]}
      canDeleteUnrestricted={caps.canDeleteUnrestricted}
      onChanged={() => {}}
    />,
  );

describe("EmailEditor — list & edit (feature 066)", () => {
  it("renders a row with address, purposes, consent topics, status (C8)", () => {
    render1();
    const r = row();
    expect(r.getByDisplayValue("a@x.com")).toBeInTheDocument();
    expect(r.getByRole("checkbox", { name: "personal" })).toBeChecked();
    expect(r.getByRole("checkbox", { name: "contra" })).toBeChecked();
    expect(r.getByRole("checkbox", { name: /Active/ })).toBeChecked();
  });

  it("editing a field + Save issues a PATCH (C8)", async () => {
    const calls = stub();
    render1();
    const r = screen.getByRole("listitem", { name: /Email a@x.com/ }); // capture once (label tracks the draft)
    const addr = within(r).getByDisplayValue("a@x.com");
    await userEvent.clear(addr);
    await userEvent.type(addr, "b@x.com");
    await userEvent.click(within(r).getByRole("button", { name: /save email/i }));
    await waitFor(() =>
      expect(
        calls.some(
          (c) => c.url.includes("/api/contacts/c1/emails/e1") && c.init?.method === "PATCH",
        ),
      ).toBe(true),
    );
  });
});

describe("EmailEditor — consent rules visible (feature 066)", () => {
  it("do-not-contact is exclusive: it greys/disables the other topics (C9)", async () => {
    render1();
    await userEvent.click(row().getByRole("checkbox", { name: "do_not_contact" }));
    expect(row().getByRole("checkbox", { name: "contra" })).toBeDisabled();
    expect(row().getByRole("checkbox", { name: "do_not_contact" })).toBeChecked();
  });

  it("prevents reaching zero purposes or zero topics (C9)", async () => {
    render1(); // one purpose, one topic
    await userEvent.click(row().getByRole("checkbox", { name: "personal" }));
    expect(row().getByRole("checkbox", { name: "personal" })).toBeChecked(); // not removed
    await userEvent.click(row().getByRole("checkbox", { name: "contra" }));
    expect(row().getByRole("checkbox", { name: "contra" })).toBeChecked(); // not removed
  });
});

describe("EmailEditor — status, add, remove, hard-delete (feature 066)", () => {
  it("status is an Active toggle; a transition row shows status read-only (C10)", () => {
    render1({ status: "transition" });
    const r = row();
    expect(r.queryByRole("checkbox", { name: /Active/ })).toBeNull();
    expect(r.getByText(/transition \(system-managed\)/i)).toBeInTheDocument();
  });

  it("soft-remove sets status inactive via PATCH (C11)", async () => {
    const calls = stub();
    render1();
    await userEvent.click(row().getByRole("checkbox", { name: /Active/ })); // → inactive
    await userEvent.click(row().getByRole("button", { name: /save email/i }));
    await waitFor(() =>
      expect(
        calls.some(
          (c) => c.init?.method === "PATCH" && String(c.init?.body).includes('"status":"inactive"'),
        ),
      ).toBe(true),
    );
  });

  it("add a new email issues a POST (C11)", async () => {
    const calls = stub();
    render1();
    await userEvent.type(screen.getByPlaceholderText(/add email address/i), "new@x.com");
    await userEvent.click(screen.getByRole("button", { name: /^add email$/i }));
    await waitFor(() =>
      expect(
        calls.some((c) => c.url.endsWith("/api/contacts/c1/emails") && c.init?.method === "POST"),
      ).toBe(true),
    );
  });

  it("hard-delete shows only with canDeleteUnrestricted and issues DELETE (C12)", async () => {
    render1(); // no delete cap
    expect(row().queryByRole("button", { name: /delete email/i })).toBeNull();

    const calls = stub();
    render(
      <EmailEditor
        contactId="c1"
        emails={[email()]}
        canDeleteUnrestricted={true}
        onChanged={() => {}}
      />,
    );
    await userEvent.click(screen.getAllByRole("button", { name: /delete email/i })[0]!);
    await waitFor(() => expect(calls.some((c) => c.init?.method === "DELETE")).toBe(true));
  });
});

describe("EmailEditor — collision → review as duplicate (feature 066)", () => {
  it("a collision shows the named prompt + keep-this/keep-other merge (C13)", async () => {
    const calls = stub({ collision: { contactId: "c2", displayName: "Jane Other" } });
    render1();
    await userEvent.click(row().getByRole("button", { name: /save email/i }));
    await waitFor(() =>
      expect(row().getByText(/already active on Jane Other/i)).toBeInTheDocument(),
    );
    await userEvent.click(row().getByRole("button", { name: /keep this contact/i }));
    await waitFor(() =>
      expect(
        calls.some(
          (c) =>
            c.url.includes("/api/dedup/merge") &&
            String(c.init?.body).includes('"canonicalId":"c1"') &&
            String(c.init?.body).includes('"mergedId":"c2"'),
        ),
      ).toBe(true),
    );
  });
});

describe("EmailEditor — login marked & guarded (feature 066)", () => {
  it("marks the login row and confirms an address change before sending (C14)", async () => {
    const calls = stub();
    render1({ isLogin: true });
    const r = screen.getByRole("listitem", { name: /Email a@x.com/ }); // capture once
    expect(within(r).getByText(/used for staff sign-in/i)).toBeInTheDocument();
    const addr = within(r).getByDisplayValue("a@x.com");
    await userEvent.clear(addr);
    await userEvent.type(addr, "moved@x.com");
    await userEvent.click(within(r).getByRole("button", { name: /save email/i }));
    // Not yet sent — a confirmation is required first.
    expect(calls.some((c) => c.init?.method === "PATCH")).toBe(false);
    await userEvent.click(within(r).getByRole("button", { name: /staff sign-in email/i }));
    await waitFor(() => expect(calls.some((c) => c.init?.method === "PATCH")).toBe(true));
  });
});

describe("EmailEditor — telemetry read-only (feature 066)", () => {
  it("shows a compact read-only telemetry hint (C15)", () => {
    render1({ providerLastOpen: new Date(Date.now() - 90 * 86_400_000).toISOString() });
    const hint = row().getByText(/opened .*ago/i);
    expect(hint.tagName).toBe("P"); // read-only text, not an input
  });
});
