// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ContactsPage from "@/app/(admin)/contacts/page";

afterEach(() => vi.unstubAllGlobals());

type Rec = {
  id: string;
  firstName: string;
  lastName: string | null;
  displayName: string;
  displayNameOverride: string | null;
  pronouns: string | null;
  phone: string | null;
  isVolunteer: boolean;
  membershipStatus: string;
  listMember: boolean;
  needsReview: boolean;
  volunteerApprovedAt: string | null;
  volunteerApprovedBy: string | null;
};

const REC = (over: Partial<Rec> = {}): Rec => ({
  id: "c1",
  firstName: "Jon",
  lastName: "Smith",
  displayName: "Jon Smith",
  displayNameOverride: null,
  pronouns: "he/him",
  phone: "+15855551234",
  isVolunteer: false,
  membershipStatus: "current",
  listMember: true,
  needsReview: false,
  volunteerApprovedAt: null,
  volunteerApprovedBy: null,
  ...over,
});

const summary = (r: Rec) => ({
  id: r.id,
  displayName: r.displayName,
  membershipStatus: r.membershipStatus,
  listMember: r.listMember,
  pronouns: r.pronouns,
});
const dup = (id: string, name: string) => ({ id, displayName: name });

type Call = { url: string; init?: RequestInit };
const json = (body: unknown, status = 200) => ({
  ok: status < 400,
  status,
  json: async () => body,
});

// One stub for every endpoint the launcher touches. Order matters (specific paths before generic ones).
function stub(opts: {
  items?: unknown[];
  review?: unknown[];
  pairs?: unknown[];
  record?: Rec;
  counts?: { needsReview: number; duplicates: number };
}): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      const method = init?.method ?? "GET";
      calls.push({ url: u, init });
      if (u.includes("/api/contacts/launcher-counts"))
        return json({
          needsReview: opts.counts?.needsReview ?? 0,
          duplicates: opts.counts?.duplicates ?? 0,
        });
      if (u.includes("/api/dedup/merge")) return json({});
      if (u.includes("/api/dedup/suggestions")) return json({ pairs: opts.pairs ?? [] });
      if (/\/api\/contacts\/[^/?]+\/reviewed$/.test(u)) return json({});
      if (u.includes("needsReview=1")) return json({ items: opts.review ?? [] });
      if (u.includes("/api/contacts?")) return json({ items: opts.items ?? [] });
      if (method === "PATCH" && /\/api\/contacts\/[^/?]+$/.test(u))
        return json({ ...(opts.record ?? REC()), ...JSON.parse(String(init?.body)) });
      if (method === "POST" && u.endsWith("/api/contacts")) return json({ id: "new" }, 201);
      if (/\/api\/contacts\/[^/?]+$/.test(u)) return json(opts.record ?? REC());
      return json({ items: [] });
    }),
  );
  return calls;
}

const search = () => screen.getByPlaceholderText(/search by name/i);
const patchBody = (calls: Call[]) =>
  String(calls.find((c) => c.init?.method === "PATCH")?.init?.body ?? "");

/** Open a record by typing (to surface the search list) then clicking its row; returns the dialog. */
async function openViaSearch(name: RegExp | string) {
  await userEvent.type(search(), "x");
  await userEvent.click(await screen.findByRole("button", { name }));
  return await screen.findByRole("dialog", { name });
}

describe("contacts launcher — initial state (feature 064)", () => {
  it("shows only header + search + task buttons, no lists or create form (C8)", async () => {
    stub({ counts: { needsReview: 3, duplicates: 2 } });
    render(<ContactsPage />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /review queue/i })).toHaveTextContent("(3)"),
    );
    expect(screen.getByRole("button", { name: /add contact/i })).toBeInTheDocument();
    expect(screen.queryByText(/potential duplicates/i)).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByPlaceholderText("First name")).toBeNull(); // create form not inline
  });

  it("renders the two counts on the review buttons (C9)", async () => {
    stub({ counts: { needsReview: 5, duplicates: 1 } });
    render(<ContactsPage />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /review queue/i })).toHaveTextContent("(5)"),
    );
    expect(screen.getByRole("button", { name: /review duplicates/i })).toHaveTextContent("(1)");
  });
});

describe("contacts launcher — review queue (feature 064)", () => {
  it("tapping Review queue lists needs-review contacts; a row opens the editor (C10)", async () => {
    stub({ review: [summary(REC({ needsReview: true }))], record: REC({ needsReview: true }) });
    render(<ContactsPage />);
    await userEvent.click(screen.getByRole("button", { name: /review queue/i }));
    await userEvent.click(await screen.findByRole("button", { name: /Jon Smith/ }));
    expect(await screen.findByRole("dialog", { name: /Jon Smith/ })).toBeInTheDocument();
  });

  it("Mark reviewed clears the flag, drops the count, and the row leaves the queue (C15/C16/C14)", async () => {
    const calls = stub({
      review: [summary(REC({ needsReview: true }))],
      record: REC({ needsReview: true }),
      counts: { needsReview: 1, duplicates: 0 },
    });
    render(<ContactsPage />);
    await userEvent.click(screen.getByRole("button", { name: /review queue/i }));
    await userEvent.click(await screen.findByRole("button", { name: /Jon Smith/ }));
    const dialog = await screen.findByRole("dialog", { name: /Jon Smith/ });
    calls.length = 0; // assert only the post-action calls
    await userEvent.click(within(dialog).getByRole("button", { name: /mark reviewed/i }));
    await waitFor(() =>
      expect(calls.some((c) => c.url.includes("/reviewed") && c.init?.method === "POST")).toBe(
        true,
      ),
    );
    // count refreshed + list re-fetched (F1/F2)
    await waitFor(() => expect(calls.some((c) => c.url.includes("launcher-counts"))).toBe(true));
    expect(calls.some((c) => c.url.includes("needsReview=1"))).toBe(true);
  });
});

describe("contacts launcher — duplicates view (feature 064)", () => {
  it("tapping Review duplicates shows the global pairs; merge removes it + refreshes counts (C11/C14)", async () => {
    const calls = stub({
      pairs: [{ a: dup("a1", "Jon Smith"), b: dup("b1", "John Smith"), similarity: 0.9 }],
      counts: { needsReview: 0, duplicates: 1 },
    });
    render(<ContactsPage />);
    await userEvent.click(screen.getByRole("button", { name: /review duplicates/i }));
    await screen.findByText("Jon Smith ↔ John Smith");
    calls.length = 0;
    await userEvent.click(screen.getByRole("button", { name: /keep jon smith/i }));
    await waitFor(() =>
      expect(
        calls.some(
          (c) =>
            c.url.includes("/api/dedup/merge") &&
            c.init?.method === "POST" &&
            String(c.init?.body).includes('"canonicalId":"a1"'),
        ),
      ).toBe(true),
    );
    await waitFor(() => expect(calls.some((c) => c.url.includes("launcher-counts"))).toBe(true));
  });

  it("shows an empty state when there are no global pairs", async () => {
    stub({ pairs: [] });
    render(<ContactsPage />);
    await userEvent.click(screen.getByRole("button", { name: /review duplicates/i }));
    expect(await screen.findByText(/no potential duplicates/i)).toBeInTheDocument();
  });
});

describe("contacts launcher — search hybrid + exclusivity (feature 064)", () => {
  it("typing shows single results with query-scoped pairs alongside (C12)", async () => {
    stub({
      items: [summary(REC({ id: "1", displayName: "Jon Smith" }))],
      pairs: [{ a: dup("1", "Jon Smith"), b: dup("2", "John Smith"), similarity: 0.9 }],
    });
    render(<ContactsPage />);
    await userEvent.type(search(), "smith");
    expect(await screen.findByText(/Potential duplicates/i)).toBeInTheDocument();
    expect(screen.getByText("Jon Smith ↔ John Smith")).toBeInTheDocument();
  });

  it("clearing the search box returns to the bare launcher (C12)", async () => {
    stub({ items: [summary(REC({ displayName: "Ada Lovelace" }))] });
    render(<ContactsPage />);
    await userEvent.type(search(), "ada");
    await screen.findByText(/Ada Lovelace/);
    await userEvent.clear(search());
    await waitFor(() => expect(screen.queryByText(/Ada Lovelace/)).toBeNull());
    expect(screen.getByRole("button", { name: /review queue/i })).toBeInTheDocument();
  });
});

describe("contacts launcher — add contact modal (feature 064)", () => {
  it("Add contact opens a modal; submit creates, closes, and refreshes (C13/C14)", async () => {
    const calls = stub({ counts: { needsReview: 0, duplicates: 0 } });
    render(<ContactsPage />);
    await userEvent.click(screen.getByRole("button", { name: /add contact/i }));
    const dialog = await screen.findByRole("dialog", { name: /add contact/i });
    await userEvent.type(within(dialog).getByPlaceholderText("First name"), "Grace");
    calls.length = 0;
    await userEvent.click(within(dialog).getByRole("button", { name: /^create$/i }));
    await waitFor(() =>
      expect(calls.some((c) => c.url.endsWith("/api/contacts") && c.init?.method === "POST")).toBe(
        true,
      ),
    );
    await waitFor(() => expect(screen.queryByRole("dialog", { name: /add contact/i })).toBeNull());
    expect(calls.some((c) => c.url.includes("launcher-counts"))).toBe(true);
  });

  it("Cancel closes the create modal without a POST", async () => {
    const calls = stub({});
    render(<ContactsPage />);
    await userEvent.click(screen.getByRole("button", { name: /add contact/i }));
    const dialog = await screen.findByRole("dialog", { name: /add contact/i });
    await userEvent.click(within(dialog).getByRole("button", { name: /cancel/i }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: /add contact/i })).toBeNull());
    expect(calls.some((c) => c.init?.method === "POST")).toBe(false);
  });
});

// Feature 063 editor coverage, adapted to the 064 open-via-search flow.
describe("record editor (feature 063, via launcher)", () => {
  it("opens pre-filled with a formatted phone", async () => {
    stub({ items: [summary(REC())], record: REC() });
    render(<ContactsPage />);
    const dialog = await openViaSearch(/Jon Smith/);
    expect(within(dialog).getByDisplayValue("Jon")).toBeInTheDocument();
    expect(within(dialog).getByDisplayValue("585-555-1234")).toBeInTheDocument();
    for (const label of ["First name", "Last name", "Display name", "Pronouns", "Phone"])
      expect(within(dialog).getByLabelText(label)).toBeInTheDocument();
  });

  it("Save issues one PATCH with the edited fields", async () => {
    const calls = stub({ items: [summary(REC())], record: REC() });
    render(<ContactsPage />);
    const dialog = await openViaSearch(/Jon Smith/);
    const last = within(dialog).getByLabelText("Last name");
    await userEvent.clear(last);
    await userEvent.type(last, "Smithe");
    await userEvent.click(within(dialog).getByRole("button", { name: /^save$/i }));
    await waitFor(() => expect(patchBody(calls)).toContain('"lastName":"Smithe"'));
  });

  it("Automatic → Set custom name → Save sends the override", async () => {
    const calls = stub({ items: [summary(REC())], record: REC() });
    render(<ContactsPage />);
    const dialog = await openViaSearch(/Jon Smith/);
    await userEvent.click(within(dialog).getByRole("button", { name: /set custom name/i }));
    await userEvent.click(within(dialog).getByRole("button", { name: /^save$/i }));
    await waitFor(() => expect(patchBody(calls)).toContain('"displayNameOverride":"Jon Smith"'));
  });

  it("is_volunteer is read-only (no toggle) and never sent on Save", async () => {
    const calls = stub({
      items: [summary(REC({ isVolunteer: true }))],
      record: REC({ isVolunteer: true }),
    });
    render(<ContactsPage />);
    const dialog = await openViaSearch(/Jon Smith/);
    expect(within(dialog).queryByRole("checkbox", { name: /volunteer/i })).toBeNull();
    expect(within(dialog).getByText(/volunteer:/i)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: /^save$/i }));
    await waitFor(() => expect(patchBody(calls)).not.toContain("isVolunteer"));
  });

  it("Escape closes the editor modal", async () => {
    stub({ items: [summary(REC())], record: REC() });
    render(<ContactsPage />);
    await openViaSearch(/Jon Smith/);
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: /Jon Smith/ })).toBeNull());
  });

  it("shows Mark reviewed only for a flagged contact", async () => {
    stub({ items: [summary(REC({ needsReview: true }))], record: REC({ needsReview: true }) });
    render(<ContactsPage />);
    const dialog = await openViaSearch(/Jon Smith/);
    expect(within(dialog).getByRole("button", { name: /mark reviewed/i })).toBeInTheDocument();
  });
});
