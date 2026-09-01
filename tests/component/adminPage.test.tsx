// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import AdminPage from "@/app/(admin)/_components/AdminPage";

// Feature 060 (X-R1): the mobile-first admin page shell — one <main> landmark carrying the page <h1> and
// its content, replacing ad-hoc `<main style={{...}}>`.
describe("AdminPage (admin shell)", () => {
  it("renders a main landmark with the title as h1 and its children", () => {
    render(
      <AdminPage title="Contacts">
        <p>child content</p>
      </AdminPage>,
    );
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Contacts" })).toBeInTheDocument();
    expect(screen.getByText("child content")).toBeInTheDocument();
  });
});
