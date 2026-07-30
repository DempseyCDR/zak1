// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Feature 025 US4 (FR-017): the home page shows the role-aware staff nav when signed in, and omits it when
// anonymous. The Nav component itself (already tested) is stubbed; getCurrentStaff drives the branch.
vi.mock("@/server/auth/currentStaff", () => ({ getCurrentStaff: vi.fn() }));
vi.mock("@/app/Nav", () => ({
  default: () => <nav data-testid="staff-nav">staff nav</nav>,
}));

import Home from "@/app/page";
import { getCurrentStaff } from "@/server/auth/currentStaff";

const mockStaff = vi.mocked(getCurrentStaff);

describe("Home page staff nav", () => {
  beforeEach(() => mockStaff.mockReset());
  afterEach(() => vi.clearAllMocks());

  it("renders the staff nav when signed in", async () => {
    mockStaff.mockResolvedValue({ contactId: "c1" } as Awaited<ReturnType<typeof getCurrentStaff>>);
    render(await Home());
    expect(screen.getByTestId("staff-nav")).toBeInTheDocument();
  });

  it("omits the staff nav when anonymous", async () => {
    mockStaff.mockResolvedValue(null);
    render(await Home());
    expect(screen.queryByTestId("staff-nav")).toBeNull();
  });
});
