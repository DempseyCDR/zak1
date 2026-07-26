import { describe, expect, it } from "vitest";
import { mailtoEmailFor } from "@/server/domain/contacts/mailtoEmail";

// Feature 020 US2 (FR-011): pick the performer's contact email for a mailto — first ACTIVE email whose
// purposes include, in order, booking > personal > public_profile; exclude `other`; null when none.
describe("mailtoEmailFor", () => {
  it("prefers booking over personal over public_profile", () => {
    expect(
      mailtoEmailFor([
        { email: "pers@ex.com", purposes: ["personal"], status: "active" },
        { email: "book@ex.com", purposes: ["booking"], status: "active" },
        { email: "pub@ex.com", purposes: ["public_profile"], status: "active" },
      ]),
    ).toBe("book@ex.com");
  });

  it("falls through to personal, then public_profile", () => {
    expect(
      mailtoEmailFor([
        { email: "pub@ex.com", purposes: ["public_profile"], status: "active" },
        { email: "pers@ex.com", purposes: ["personal"], status: "active" },
      ]),
    ).toBe("pers@ex.com");
    expect(
      mailtoEmailFor([{ email: "pub@ex.com", purposes: ["public_profile"], status: "active" }]),
    ).toBe("pub@ex.com");
  });

  it("ignores inactive emails and the 'other' purpose", () => {
    expect(
      mailtoEmailFor([
        { email: "book@ex.com", purposes: ["booking"], status: "inactive" },
        { email: "other@ex.com", purposes: ["other"], status: "active" },
      ]),
    ).toBeNull();
  });

  it("returns null for no emails", () => {
    expect(mailtoEmailFor([])).toBeNull();
  });
});
