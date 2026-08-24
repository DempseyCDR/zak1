// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import RosterEntry from "@/app/(public)/_components/RosterEntry";
import PromoLinks from "@/app/(public)/_components/PromoLinks";

// Feature 053 (P7-R9): the roster renders public-safe fields only; promo links are safe outbound anchors;
// members show their instrument; a no-photo entry renders without a broken <img>; no PII appears.
describe("PromoLinks", () => {
  it("renders each link as an outbound anchor with safe rel", () => {
    render(<PromoLinks links={[{ type: "website", url: "https://freeraisins.example" }]} />);
    const link = screen.getByRole("link", { name: "Website" });
    expect(link.getAttribute("href")).toBe("https://freeraisins.example");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer nofollow");
  });

  it("renders nothing for an empty list", () => {
    const { container } = render(<PromoLinks links={[]} />);
    expect(container.querySelector("a")).toBeNull();
  });
});

describe("RosterEntry", () => {
  it("renders a band: anchor id, styles, members with instruments, promo link — no PII", () => {
    render(
      <RosterEntry
        anchorId="band-abc"
        name="The Free Raisins"
        bio="A lively contra band."
        photoUrl={null}
        styleTags={["contra"]}
        links={[{ type: "bandcamp", url: "https://freeraisins.bandcamp.com" }]}
        members={[{ name: "Fiddler Fran", isLead: true, instrument: "fiddle" }]}
      />,
    );
    const heading = screen.getByRole("heading", { name: "The Free Raisins" });
    expect(heading.getAttribute("id")).toBe("band-abc");
    expect(screen.getByText(/Fiddler Fran — fiddle \(lead\)/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Bandcamp" })).toBeInTheDocument();
    // No photo → no <img>.
    expect(document.querySelector("img")).toBeNull();
    // No contact/PII text.
    expect(screen.queryByText(/@/)).toBeNull();
  });

  it("renders a caller (no members) with its anchor id", () => {
    render(
      <RosterEntry
        anchorId="caller-xyz"
        name="Cathy Caller"
        bio={null}
        photoUrl={null}
        styleTags={["english"]}
        links={[]}
      />,
    );
    expect(screen.getByRole("heading", { name: "Cathy Caller" }).getAttribute("id")).toBe(
      "caller-xyz",
    );
    expect(document.querySelector("ul li")).toBeTruthy(); // the style chip list renders
  });
});
