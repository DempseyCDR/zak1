// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import ContactList from "@/app/(public)/_components/ContactList";

// Feature 055 (P7-R12): the merged contact directory renders each role with its alias (mailto) and, for a
// board seat with a designated officer, the officer's name. Role addresses only — no personal PII.
describe("ContactList", () => {
  it("renders roles with alias (mailto), an officer name when present, and no name otherwise", () => {
    render(
      <ContactList
        entries={[
          { roleName: "Treasurer", emailAlias: "treasurer@cdrochester.org", name: "Jane Doe" },
          { roleName: "President", emailAlias: "president@cdrochester.org", name: null },
          { roleName: "General inquiries", emailAlias: "info@cdrochester.org", name: null },
        ]}
      />,
    );
    // a board officer shows their name + role + alias
    expect(screen.getByText("Treasurer")).toBeInTheDocument();
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "treasurer@cdrochester.org" }).getAttribute("href"),
    ).toBe("mailto:treasurer@cdrochester.org");
    // a vacant seat / function alias shows role + alias, no name
    expect(screen.getByText("General inquiries")).toBeInTheDocument();
    // every alias is a @cdrochester.org role address (no personal/individual email)
    for (const link of screen.getAllByRole("link")) {
      expect(link.getAttribute("href")).toMatch(/^mailto:[a-z0-9._-]+@cdrochester\.org$/);
    }
  });
});
