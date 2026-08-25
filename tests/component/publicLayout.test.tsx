// @vitest-environment jsdom
import type { ComponentProps } from "react";
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import Container from "@/app/(public)/_components/Container";
import ScheduleList from "@/app/(public)/_components/ScheduleList";
import SeriesFilter from "@/app/(public)/_components/SeriesFilter";

// Feature 045 (P7-R1, US1): the shared public components render from CSS-Module classes, carry no ad-hoc
// inline sizing (SC-006), and introduce no <h1> (the page owns the single H1). The DB-backed pages are
// async server components (not jsdom-renderable), so page-level guards live in publicHeadings.test.ts.

/** No element in the tree carries an inline layout style (moved to CSS Modules / tokens). */
function noInlineLayoutStyles(root: HTMLElement): boolean {
  return [...root.querySelectorAll<HTMLElement>("[style]")].every((el) => {
    const s = el.getAttribute("style") ?? "";
    return !/max-width|padding|border|margin/i.test(s);
  });
}

type Items = ComponentProps<typeof ScheduleList>["items"];
const items = [
  {
    eventId: "e1",
    date: "2026-09-03",
    startTime: "7:30 PM",
    activity: "Contra Dance",
    label: null,
    venueName: "Rose Room",
    pricing: { kind: "flat", amount: 12 },
    cancelled: false,
  },
] as unknown as Items;

describe("public layout primitives (US1)", () => {
  it("Container renders a <main> landmark with a module class", () => {
    const { container } = render(<Container>hello</Container>);
    const main = container.querySelector("main");
    expect(main).not.toBeNull();
    expect(main!.className).toBeTruthy();
    expect(noInlineLayoutStyles(container)).toBe(true);
  });

  it("ScheduleList uses module classes, no inline sizing, and no <h1>", () => {
    const { container } = render(<ScheduleList items={items} />);
    const list = container.querySelector("ul");
    expect(list).not.toBeNull();
    expect(list!.className).toBeTruthy();
    expect(container.querySelector("h1")).toBeNull();
    expect(noInlineLayoutStyles(container)).toBe(true);
  });

  it("SeriesFilter uses module classes, no inline sizing, and no <h1>", () => {
    const { container } = render(
      <SeriesFilter
        series={[{ key: "tnc", name: "Thursday Night Contra" }]}
        basePath="/whats-on"
      />,
    );
    expect(container.querySelector("nav")).not.toBeNull();
    expect(container.querySelector("h1")).toBeNull();
    expect(noInlineLayoutStyles(container)).toBe(true);
  });
});
