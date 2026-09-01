// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TriageList from "@/app/(admin)/_components/TriageList";

// Feature 060 (X-R2): Triage mode — a worklist. Rows render primary content and an "open" affordance
// (the Triage→Record bridge, FR-007); an empty list shows the provided empty state (not a blank region).
type Row = { id: string; name: string };
const rows: Row[] = [
  { id: "1", name: "Ada" },
  { id: "2", name: "Grace" },
];

describe("TriageList (Triage mode)", () => {
  it("renders each item as a row and opens the record via onOpen", async () => {
    const onOpen = vi.fn();
    render(
      <TriageList
        items={rows}
        getKey={(r) => r.id}
        renderRow={(r) => <span>{r.name}</span>}
        onOpen={onOpen}
        emptyState={<p>No items</p>}
      />,
    );
    expect(screen.getByText("Ada")).toBeInTheDocument();
    expect(screen.getByText("Grace")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Grace"));
    expect(onOpen).toHaveBeenCalledWith(rows[1]);
  });

  it("renders the empty state when there are no items", () => {
    render(
      <TriageList
        items={[]}
        getKey={(r: Row) => r.id}
        renderRow={(r: Row) => <span>{r.name}</span>}
        emptyState={<p>No items</p>}
      />,
    );
    expect(screen.getByText("No items")).toBeInTheDocument();
  });
});
