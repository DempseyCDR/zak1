// @vitest-environment jsdom
import type { ReactNode } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Feature 047 (P7-R3, US1): the "new here?" orientation block conveys the welcome and leads onward.
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: ReactNode;
    [k: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import NewHere from "@/app/(public)/_components/NewHere";

describe("home orientation block (US1)", () => {
  it("welcomes newcomers (no partner / all welcome) and links onward to the schedule", () => {
    render(<NewHere />);
    expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument();
    const text = document.body.textContent ?? "";
    expect(text).toMatch(/welcome/i);
    expect(text).toMatch(/no partner/i);
    const onward = screen.getByRole("link", { name: /dances|schedule/i });
    expect(onward).toHaveAttribute("href", "/whats-on");
  });
});
