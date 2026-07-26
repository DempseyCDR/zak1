// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Feature 020: proves the component-test harness works end-to-end — jsdom env, RTL render/query,
// user-event interaction, and jest-dom matchers — and that a stubbed fetch is available for the modal
// tests (fetch-stubbing is UI-boundary isolation, NOT the DB-no-mock rule, which governs integration
// tests). The real modal component tests are written alongside each modal during implementation.
function Counter() {
  const [n, setN] = useState(0);
  return (
    <div>
      <p>Count: {n}</p>
      <button onClick={() => setN((v) => v + 1)}>Increment</button>
    </div>
  );
}

describe("component-test harness (smoke)", () => {
  it("renders, queries by role/text, and reacts to a user click", async () => {
    const user = userEvent.setup();
    render(<Counter />);
    expect(screen.getByText("Count: 0")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Increment" }));
    expect(screen.getByText("Count: 1")).toBeInTheDocument();
  });

  it("can stub fetch for UI-boundary isolation", async () => {
    const stub = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ items: [{ id: "1", displayName: "Bob Fabinski" }] }),
    });
    vi.stubGlobal("fetch", stub);
    const res = await fetch("/api/performers?q=fab");
    expect((await res.json()).items[0].displayName).toBe("Bob Fabinski");
    vi.unstubAllGlobals();
  });
});
