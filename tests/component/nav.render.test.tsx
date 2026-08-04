// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Feature 035 (P6-R2): Nav is the server loader rendered from the ROOT layout on every page. It must
// return null for anonymous visitors (FR-005) and render the role-filtered presenter when signed in.
// The presenter (VolunteerNav, already tested) and the grants loader are stubbed here.
vi.mock("@/server/auth/currentStaff", () => ({ getActor: vi.fn() }));
vi.mock("@/server/auth/nav", () => ({ navItemsFor: vi.fn(() => [{ href: "/gate", label: "Gate money" }]) }));
vi.mock("@/app/VolunteerNav", () => ({
  default: ({ items }: { items: { href: string }[] }) => (
    <nav data-testid="vnav">{items.length} items</nav>
  ),
}));

import Nav from "@/app/Nav";
import { getActor } from "@/server/auth/currentStaff";

const mockActor = vi.mocked(getActor);

describe("Nav — root-layout server loader", () => {
  beforeEach(() => mockActor.mockReset());
  afterEach(() => vi.clearAllMocks());

  it("renders nothing for an anonymous visitor", async () => {
    mockActor.mockResolvedValue(null);
    const result = await Nav();
    expect(result).toBeNull();
  });

  it("renders the volunteer presenter with role-filtered items when signed in", async () => {
    mockActor.mockResolvedValue({} as Awaited<ReturnType<typeof getActor>>);
    render(await Nav());
    expect(screen.getByTestId("vnav")).toHaveTextContent("1 items");
  });
});
