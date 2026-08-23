// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import VenueBlock from "@/app/(public)/_components/VenueBlock";

const venue = {
  name: "The Rose Room",
  address: "295 Gregory St, Rochester",
  mapUrl: "https://www.google.com/maps/search/?api=1&query=295+Gregory+St",
};

describe("VenueBlock", () => {
  it("renders the venue name and the address as a tappable map link", () => {
    render(<VenueBlock venue={venue} />);
    expect(screen.getByText("The Rose Room")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Gregory St/ });
    expect(link.getAttribute("href")).toBe(venue.mapUrl);
  });

  it("renders nothing when there is no venue", () => {
    const { container } = render(<VenueBlock venue={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders no <h1>", () => {
    const { container } = render(<VenueBlock venue={venue} />);
    expect(container.querySelector("h1")).toBeNull();
  });
});
