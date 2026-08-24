// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import Lineup from "@/app/(public)/_components/Lineup";
import type { PublicBandBlock } from "@/server/domain/public/publicSchedule";
import type { PublicPerformer } from "@/server/domain/public/performerDisplay";

const band: PublicBandBlock = {
  bandId: "band-1",
  name: "The Testers",
  bio: "we test",
  photoUrl: null,
  members: [
    { name: "Ada Lead", isLead: true, instrument: "fiddle" },
    { name: "Ben Member", isLead: false, instrument: null },
  ],
  onPublicRoster: false,
};
const caller: PublicPerformer = {
  kind: "full_bio",
  name: "Cora Caller",
  bio: null,
  photoUrl: null,
  performerId: "perf-1",
  onPublicRoster: false,
};

describe("Lineup", () => {
  it("renders each band with its members (and instruments) and the callers/other performers", () => {
    render(<Lineup bandBlocks={[band]} performers={[caller]} />);
    expect(screen.getByText("The Testers")).toBeInTheDocument();
    expect(screen.getByText(/Ada Lead — fiddle \(lead\)/)).toBeInTheDocument();
    expect(screen.getByText(/Ben Member/)).toBeInTheDocument();
    expect(screen.getByText("Cora Caller")).toBeInTheDocument();
    expect(screen.queryByText(/to be announced/i)).not.toBeInTheDocument();
  });

  it("links a band/caller name to its roster anchor ONLY when it is on the public roster", () => {
    const publicBand: PublicBandBlock = { ...band, onPublicRoster: true };
    const publicCaller: PublicPerformer = { ...caller, onPublicRoster: true };
    render(<Lineup bandBlocks={[publicBand]} performers={[publicCaller]} />);
    expect(screen.getByRole("link", { name: "The Testers" }).getAttribute("href")).toBe(
      "/performers#band-band-1",
    );
    expect(screen.getByRole("link", { name: "Cora Caller" }).getAttribute("href")).toBe(
      "/performers#caller-perf-1",
    );
  });

  it("renders a non-roster band/caller (private, archived, or non-caller) as plain text — no broken link", () => {
    render(<Lineup bandBlocks={[band]} performers={[caller]} />);
    expect(screen.queryByRole("link", { name: "The Testers" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Cora Caller" })).toBeNull();
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
