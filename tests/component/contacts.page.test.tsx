// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
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

// Feature 063 (M-R5..M-R8): the record editor — editable scalar fields, Automatic/Custom display name,
// governance-gated is_volunteer, and read-only standing context.
type EditorRecord = {
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
  source: string | null;
  emails: unknown[];
};

const REC = (over: Partial<EditorRecord> = {}): EditorRecord => ({
  id: "c1",
  firstName: "Jon",
  lastName: "Smith",
  displayName: "Jon Smith",
  displayNameOverride: null,
  pronouns: "he/him",
  phone: "+15855551234", // stored canonical form (feature 032)
  isVolunteer: false,
  membershipStatus: "current",
  listMember: true,
  needsReview: false,
  volunteerApprovedAt: null,
  volunteerApprovedBy: null,
  source: "import",
  emails: [],
  ...over,
});

// Full stub: search list, dedup suggestions, single-record GET, and PATCH.
function stubEditor(opts: { record: EditorRecord }): { url: string; init?: RequestInit }[] {
  const calls: { url: string; init?: RequestInit }[] = [];
  const rec = opts.record;
  const summary = {
    id: rec.id,
    displayName: rec.displayName,
    membershipStatus: rec.membershipStatus,
    listMember: rec.listMember,
    pronouns: rec.pronouns,
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      calls.push({ url: u, init });
      if (init?.method === "PATCH") {
        const patch = JSON.parse(String(init.body));
        return { ok: true, status: 200, json: async () => ({ ...rec, ...patch }) };
      }
      if (u.includes("/api/dedup/suggestions"))
        return { ok: true, status: 200, json: async () => ({ pairs: [] }) };
      if (u.includes("/api/contacts?"))
        return { ok: true, status: 200, json: async () => ({ items: [summary] }) };
      if (/\/api\/contacts\/[^?]+$/.test(u))
        return { ok: true, status: 200, json: async () => rec };
      return { ok: true, status: 200, json: async () => ({ items: [] }) };
    }),
  );
  return calls;
}

/** Open the single record by clicking its search-result row, and return the record region. */
async function openRecord(name: RegExp | string) {
  await userEvent.click(await screen.findByRole("button", { name }));
  return await screen.findByRole("region", { name });
}

describe("contacts page — record editor (feature 063)", () => {
  it("opens a record pre-filled from the full contact fetch (C4)", async () => {
    stubEditor({ record: REC() });
    render(<ContactsPage />);
    const region = await openRecord(/Jon Smith/);
    expect(within(region).getByDisplayValue("Jon")).toBeInTheDocument();
    expect(within(region).getByDisplayValue("Smith")).toBeInTheDocument();
    expect(within(region).getByDisplayValue("he/him")).toBeInTheDocument();
    expect(within(region).getByDisplayValue("585-555-1234")).toBeInTheDocument(); // formatted (FR-019)
  });

  it("Save issues one PATCH with the edited scalar fields (C5)", async () => {
    const calls = stubEditor({ record: REC() });
    render(<ContactsPage />);
    const region = await openRecord(/Jon Smith/);
    const last = within(region).getByDisplayValue("Smith");
    await userEvent.clear(last);
    await userEvent.type(last, "Smithe");
    await userEvent.click(within(region).getByRole("button", { name: /^save$/i }));
    await waitFor(() =>
      expect(
        calls.some(
          (c) =>
            c.url.includes("/api/contacts/c1") &&
            c.init?.method === "PATCH" &&
            String(c.init?.body).includes('"lastName":"Smithe"'),
        ),
      ).toBe(true),
    );
  });

  it("Cancel discards edits without a PATCH (C11)", async () => {
    const calls = stubEditor({ record: REC() });
    render(<ContactsPage />);
    const region = await openRecord(/Jon Smith/);
    const last = within(region).getByDisplayValue("Smith");
    await userEvent.clear(last);
    await userEvent.type(last, "Smithe");
    await userEvent.click(within(region).getByRole("button", { name: /cancel/i }));
    await waitFor(() => expect(screen.queryByRole("region", { name: /Jon Smith/ })).toBeNull());
    expect(calls.some((c) => c.init?.method === "PATCH")).toBe(false);
  });
});

const patchBody = (calls: { url: string; init?: RequestInit }[]) => {
  const patch = calls.find((c) => c.init?.method === "PATCH");
  return patch ? String(patch.init?.body) : "";
};

describe("contacts page — Automatic/Custom display name (feature 063)", () => {
  it("Automatic mode: read-only preview of 'first last' + Set custom name (C6)", async () => {
    stubEditor({ record: REC() });
    render(<ContactsPage />);
    const region = await openRecord(/Jon Smith/);
    const preview = within(region).getByLabelText("Display name") as HTMLInputElement;
    expect(preview.value).toBe("Jon Smith");
    expect(preview.readOnly).toBe(true);
    expect(within(region).getByRole("button", { name: /set custom name/i })).toBeInTheDocument();
  });

  it("Set custom name → editable, prefilled; Save sends non-blank override (C7)", async () => {
    const calls = stubEditor({ record: REC() });
    render(<ContactsPage />);
    const region = await openRecord(/Jon Smith/);
    await userEvent.click(within(region).getByRole("button", { name: /set custom name/i }));
    const field = within(region).getByLabelText("Display name") as HTMLInputElement;
    expect(field.readOnly).toBe(false);
    expect(field.value).toBe("Jon Smith");
    await userEvent.click(within(region).getByRole("button", { name: /^save$/i }));
    await waitFor(() => expect(patchBody(calls)).toContain('"displayNameOverride":"Jon Smith"'));
  });

  it("Custom + blank custom field on Save → override null (C8)", async () => {
    const calls = stubEditor({ record: REC({ displayNameOverride: "DJ", displayName: "DJ" }) });
    render(<ContactsPage />);
    const region = await openRecord(/DJ/);
    await userEvent.clear(within(region).getByLabelText("Display name"));
    await userEvent.click(within(region).getByRole("button", { name: /^save$/i }));
    await waitFor(() => expect(patchBody(calls)).toContain('"displayNameOverride":null'));
  });

  it("Custom: editing first/last does not move the pinned name (C12)", async () => {
    const calls = stubEditor({ record: REC({ displayNameOverride: "DJ", displayName: "DJ" }) });
    render(<ContactsPage />);
    const region = await openRecord(/DJ/);
    const last = within(region).getByDisplayValue("Smith");
    await userEvent.clear(last);
    await userEvent.type(last, "Smithe");
    expect((within(region).getByLabelText("Display name") as HTMLInputElement).value).toBe("DJ");
    await userEvent.click(within(region).getByRole("button", { name: /^save$/i }));
    await waitFor(() => expect(patchBody(calls)).toContain('"displayNameOverride":"DJ"'));
  });

  it("Custom + Reset to automatic → override null (C13)", async () => {
    const calls = stubEditor({ record: REC({ displayNameOverride: "DJ", displayName: "DJ" }) });
    render(<ContactsPage />);
    const region = await openRecord(/DJ/);
    await userEvent.click(within(region).getByRole("button", { name: /reset to automatic/i }));
    await userEvent.click(within(region).getByRole("button", { name: /^save$/i }));
    await waitFor(() => expect(patchBody(calls)).toContain('"displayNameOverride":null'));
  });
});

describe("contacts page — is_volunteer is read-only in the editor (feature 063)", () => {
  it("shows volunteer status read-only and offers no toggle (C9)", async () => {
    // is_volunteer is governance-owned (designate/clear on the access screen). The editor never edits
    // it — no checkbox, no send on Save — it only displays the current value.
    const calls = stubEditor({ record: REC({ isVolunteer: true }) });
    render(<ContactsPage />);
    const region = await openRecord(/Jon Smith/);
    expect(within(region).queryByRole("checkbox", { name: /volunteer/i })).toBeNull();
    expect(within(region).getByText(/volunteer:/i)).toBeInTheDocument(); // read-only flag, not a control
    await userEvent.click(within(region).getByRole("button", { name: /^save$/i }));
    await waitFor(() => expect(calls.some((c) => c.init?.method === "PATCH")).toBe(true));
    // A save never carries is_volunteer from the editor.
    expect(patchBody(calls)).not.toContain("isVolunteer");
  });
});

describe("contacts page — editor opens as a modal (feature 063)", () => {
  it("opens the record as a labeled dialog containing the form (C16)", async () => {
    stubEditor({ record: REC() });
    render(<ContactsPage />);
    await userEvent.click(await screen.findByRole("button", { name: /Jon Smith/ }));
    const dialog = await screen.findByRole("dialog", { name: /Jon Smith/ });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(within(dialog).getByRole("button", { name: /^save$/i })).toBeInTheDocument();
  });

  it("Escape closes the modal without a PATCH (C17)", async () => {
    const calls = stubEditor({ record: REC() });
    render(<ContactsPage />);
    await userEvent.click(await screen.findByRole("button", { name: /Jon Smith/ }));
    await screen.findByRole("dialog", { name: /Jon Smith/ });
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: /Jon Smith/ })).toBeNull());
    expect(calls.some((c) => c.init?.method === "PATCH")).toBe(false);
  });

  it("moves focus into the dialog (first field) on open (C18)", async () => {
    stubEditor({ record: REC() });
    render(<ContactsPage />);
    await userEvent.click(await screen.findByRole("button", { name: /Jon Smith/ }));
    const dialog = await screen.findByRole("dialog", { name: /Jon Smith/ });
    await waitFor(() => expect(within(dialog).getByLabelText("First name")).toHaveFocus());
  });
});

describe("contacts page — field labels + phone formatting (feature 063)", () => {
  it("every editable field has a visible label (C14)", async () => {
    stubEditor({ record: REC() });
    render(<ContactsPage />);
    const region = await openRecord(/Jon Smith/);
    for (const label of ["First name", "Last name", "Display name", "Pronouns", "Phone"]) {
      // Reachable by its label (association) AND the label text is actually rendered (visible).
      expect(within(region).getByLabelText(label)).toBeInTheDocument();
      expect(within(region).getByText(label)).toBeInTheDocument();
    }
  });

  it("shows the phone in human-readable form (C15)", async () => {
    stubEditor({ record: REC({ phone: "+15855551234" }) });
    render(<ContactsPage />);
    const region = await openRecord(/Jon Smith/);
    expect((within(region).getByLabelText("Phone") as HTMLInputElement).value).toBe("585-555-1234");
  });
});

describe("contacts page — read-only standing context (feature 063)", () => {
  it("shows volunteer, membership, needs-review, volunteer-approval; never source (C10)", async () => {
    stubEditor({
      record: REC({ membershipStatus: "current", needsReview: true, source: "import" }),
    });
    render(<ContactsPage />);
    const region = await openRecord(/Jon Smith/);
    expect(within(region).getByText(/membership/i)).toBeInTheDocument();
    expect(within(region).getByText("current")).toBeInTheDocument();
    expect(within(region).getByText(/needs review/i)).toBeInTheDocument();
    expect(within(region).getByText(/volunteer approved/i)).toBeInTheDocument();
    // `source` is internal and must never be surfaced (M-R8).
    expect(within(region).queryByText(/import/i)).toBeNull();
  });
});
