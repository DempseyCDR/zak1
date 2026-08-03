// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import DedupPage from "@/app/(admin)/dedup/page";

// Feature 033 (P5-R7): the /dedup queue shows each candidate's dashed phone + active email(s), with a clear
// "no phone" / "no email" when absent; merge controls unchanged.
const PAIRS = [
  {
    a: {
      id: "a1",
      displayName: "Chris Smith",
      membershipStatus: "active",
      phone: "+15855551234",
      emails: ["chris@example.org"],
    },
    b: { id: "b1", displayName: "Chris Smith", membershipStatus: "never", phone: null, emails: [] },
    similarity: 1,
  },
];

function stub() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const u = String(url);
      const json = async () => (u.includes("/api/dedup/suggestions") ? { pairs: PAIRS } : {});
      return { ok: true, status: 200, json };
    }),
  );
}

describe("DedupPage — phone + email per candidate (033 US1)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows dashed phone + email, and no-phone/no-email when absent; merge controls stay", async () => {
    stub();
    render(<DedupPage />);
    const pairItem = (await screen.findAllByText("Chris Smith"))[0]!.closest("li") as HTMLElement;

    // Candidate A: dashed phone (formatPhone) + its active email.
    expect(within(pairItem).getByText("585-555-1234")).toBeInTheDocument();
    expect(within(pairItem).getByText(/chris@example\.org/)).toBeInTheDocument();

    // Candidate B: no phone / no email indicated (not a blank).
    expect(within(pairItem).getByText(/no phone/i)).toBeInTheDocument();
    expect(within(pairItem).getByText(/no email/i)).toBeInTheDocument();

    // Merge controls unchanged.
    expect(
      within(pairItem).getByRole("button", { name: /keep left, merge right/i }),
    ).toBeInTheDocument();
    expect(
      within(pairItem).getByRole("button", { name: /keep right, merge left/i }),
    ).toBeInTheDocument();
  });
});
