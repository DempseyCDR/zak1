// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import Lineup from "@/app/(public)/_components/Lineup";
import type { PublicBandBlock } from "@/server/domain/public/publicSchedule";
import type { PublicPerformer } from "@/server/domain/public/performerDisplay";

const band: PublicBandBlock = {
  name: "The Testers",
  bio: "we test",
  photoUrl: null,
  members: [
    { name: "Ada Lead", isLead: true },
    { name: "Ben Member", isLead: false },
  ],
};
const caller: PublicPerformer = {
  kind: "full_bio",
  name: "Cora Caller",
  bio: null,
  photoUrl: null,
};

describe("Lineup", () => {
  it("renders each band with its members and the callers/other performers", () => {
    render(<Lineup bandBlocks={[band]} performers={[caller]} />);
    expect(screen.getByText("The Testers")).toBeInTheDocument();
    expect(screen.getByText(/Ada Lead/)).toBeInTheDocument();
    expect(screen.getByText(/Ben Member/)).toBeInTheDocument();
    expect(screen.getByText("Cora Caller")).toBeInTheDocument();
    expect(screen.queryByText(/to be announced/i)).not.toBeInTheDocument();
  });

  it("shows 'to be announced' when there is no confirmed lineup", () => {
    render(<Lineup bandBlocks={[]} performers={[]} />);
    expect(screen.getByText(/to be announced/i)).toBeInTheDocument();
  });

  it("renders no <h1>", () => {
    const { container } = render(<Lineup bandBlocks={[band]} performers={[caller]} />);
    expect(container.querySelector("h1")).toBeNull();
  });
});
