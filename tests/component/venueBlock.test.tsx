// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import VenueBlock from "@/app/(public)/_components/VenueBlock";
import type { PublicVenue } from "@/server/domain/public/publicSchedule";

const publicVenue: PublicVenue = {
  name: "The Rose Room",
  address: "295 Gregory St, Rochester",
  mapUrl: "https://www.google.com/maps/search/?api=1&query=295+Gregory+St",
  directions: "Park next door at the German House.",
};

// Feature 052 (P7-R8): a non-public venue's projection is name-only (address/map/directions null).
const privateVenue: PublicVenue = {
  name: "A Private Home",
  address: null,
  mapUrl: null,
  directions: null,
};

describe("VenueBlock", () => {
  it("renders a public venue: name, address as a tappable map link, and directions", () => {
    render(<VenueBlock venue={publicVenue} />);
    expect(screen.getByText("The Rose Room")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Gregory St/ });
    expect(link.getAttribute("href")).toBe(publicVenue.mapUrl);
    expect(screen.getByText(/Park next door/)).toBeInTheDocument();
  });

  it("renders a non-public venue as name-only: no address, map link, or directions", () => {
    render(<VenueBlock venue={privateVenue} />);
    expect(screen.getByText("A Private Home")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders nothing when there is no venue", () => {
    const { container } = render(<VenueBlock venue={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders no <h1>", () => {
    const { container } = render(<VenueBlock venue={publicVenue} />);
    expect(container.querySelector("h1")).toBeNull();
  });
});
