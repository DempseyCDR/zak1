import { describe, expect, it } from "vitest";
import { deriveContactNames } from "@/server/domain/contacts/normalize";

// Feature 017 (B34): the door captures first + last and an optional editable display name (override).
// deriveContactNames already accepts the override (feature 012); these pin the behaviour the check-in
// path relies on.
describe("deriveContactNames — door capture (B34)", () => {
  it("derives display_name = 'first last' when no override is given", () => {
    const n = deriveContactNames({ firstName: "Jane", lastName: "Smith" });
    expect(n.displayName).toBe("Jane Smith");
    expect(n.nameNormalized).toBe("jane smith");
    expect(n.dedupNormalized).toBe("jane smith");
  });

  it("lets the override win for display_name and the search key", () => {
    const n = deriveContactNames({
      firstName: "Jane",
      lastName: "Smith",
      displayNameOverride: "DJ Jane",
    });
    expect(n.displayName).toBe("DJ Jane");
    expect(n.nameNormalized).toBe("dj jane");
    // dedup key ignores the override so a nickname cannot mask a duplicate.
    expect(n.dedupNormalized).toBe("jane smith");
  });

  it("falls back to the first name alone when last name is blank", () => {
    const n = deriveContactNames({ firstName: "Madonna", lastName: null });
    expect(n.displayName).toBe("Madonna");
    expect(n.dedupNormalized).toBe("madonna");
  });
});
