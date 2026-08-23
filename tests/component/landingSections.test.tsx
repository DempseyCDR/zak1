// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import LandingSections from "@/app/(public)/_components/LandingSections";
import type { StyleLanding } from "@/app/(public)/dances/landingContent";

const content: StyleLanding = {
  slug: "contra",
  seriesKey: "tnc",
  title: "What is contra dancing?",
  intro: ["Contra dance is a social folk dance with roots going back over 400 years."],
  whyYoullLove: ["Social — you interact with everyone in the room."],
  whatToExpect: ["No partner needed.", "Wear light, comfortable clothes."],
};

describe("LandingSections", () => {
  it("renders the what-it-is / why-you'll-love / what-to-expect prose", () => {
    render(<LandingSections content={content} />);
    expect(screen.getByText(/social folk dance/)).toBeInTheDocument();
    expect(screen.getByText(/you interact with everyone/)).toBeInTheDocument();
    expect(screen.getByText("No partner needed.")).toBeInTheDocument();
    expect(screen.getByText("Wear light, comfortable clothes.")).toBeInTheDocument();
  });

  it("uses <h2> section headings and renders no <h1>", () => {
    const { container } = render(<LandingSections content={content} />);
    expect(container.querySelectorAll("h2").length).toBeGreaterThanOrEqual(3);
    expect(container.querySelector("h1")).toBeNull();
  });
});
