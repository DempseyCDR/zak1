// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import CampaignSlot from "@/app/(public)/_components/CampaignSlot";
import type { PublicCampaign } from "@/server/domain/campaigns/campaignService";

// Feature 057 (P7-R14, jsdom): the promotional slot renders heading/blurb/CTA + optional image (with alt),
// degrades to text-only, and renders an internal-path CTA as a same-tab link vs an external http(s) CTA as a
// new-tab safe link. The home page owns the empty case (renders the slot only when a campaign is shown), so the
// component is always given a non-null PublicCampaign.

const withImage: PublicCampaign = {
  id: "c1",
  heading: "Golden Celebration Weekend",
  blurb: "Three days of dancing — Nov 27–29.",
  image: { url: "https://ex.org/golden.jpg", alt: "Dancers at the 50th" },
  cta: { label: "Learn more", url: "/golden-weekend" },
};

const external: PublicCampaign = {
  id: "c2",
  heading: "Get tickets",
  blurb: "Weekend passes on sale now.",
  image: null,
  cta: { label: "Buy passes", url: "https://tickets.example.org/golden" },
};

afterEach(cleanup);

describe("CampaignSlot", () => {
  it("renders the heading, blurb, and CTA", () => {
    render(<CampaignSlot campaign={withImage} />);
    expect(screen.getByText("Golden Celebration Weekend")).toBeTruthy();
    expect(screen.getByText("Three days of dancing — Nov 27–29.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Learn more" })).toBeTruthy();
  });

  it("renders the image with its alt text when set", () => {
    render(<CampaignSlot campaign={withImage} />);
    const img = screen.getByAltText("Dancers at the 50th") as HTMLImageElement;
    expect(img.tagName).toBe("IMG");
    expect(img.getAttribute("src")).toBe("https://ex.org/golden.jpg");
    expect(img.getAttribute("loading")).toBe("lazy");
  });

  it("renders text-only (no img) when no image is set", () => {
    render(<CampaignSlot campaign={external} />);
    expect(screen.queryByRole("img")).toBeNull();
    expect(document.querySelector("img")).toBeNull();
  });

  it("renders an internal-path CTA as a same-tab link (no target)", () => {
    render(<CampaignSlot campaign={withImage} />);
    const link = screen.getByRole("link", { name: "Learn more" });
    expect(link.getAttribute("href")).toBe("/golden-weekend");
    expect(link.getAttribute("target")).toBeNull();
  });

  it("renders an external http(s) CTA as a new-tab safe link", () => {
    render(<CampaignSlot campaign={external} />);
    const link = screen.getByRole("link", { name: "Buy passes" });
    expect(link.getAttribute("href")).toBe("https://tickets.example.org/golden");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });
});
