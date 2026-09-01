// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import RecordView from "@/app/(admin)/_components/RecordView";

// Feature 060 (X-R2): Record mode — a focused single-entity shell. Presentation only: it renders the
// title, an optional actions slot, and its children; it performs no data fetching of its own.
afterEach(() => vi.unstubAllGlobals());

describe("RecordView (Record mode)", () => {
  it("renders a titled region with an actions slot and body content", () => {
    render(
      <RecordView title="Ada Lovelace" actions={<button type="button">Edit</button>}>
        <dl>
          <dt>Pronouns</dt>
          <dd>she/her</dd>
        </dl>
      </RecordView>,
    );
    expect(screen.getByRole("region", { name: "Ada Lovelace" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ada Lovelace" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByText("she/her")).toBeInTheDocument();
  });

  it("performs no data calls (presentation only)", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    render(
      <RecordView title="X">
        <span>y</span>
      </RecordView>,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
