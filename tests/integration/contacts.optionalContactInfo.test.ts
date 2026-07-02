import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb } from "./helpers/db";
import { jsonReq, ctx } from "./helpers/http";
import { POST as CREATE } from "@/app/api/contacts/route";

// Email and phone are both optional at contact creation; neither being present
// is allowed but flags the contact (needsReview) for admin follow-up.
describe("contact creation with optional email/phone", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("creates a contact with only a phone number (no email)", async () => {
    const res = await CREATE(
      jsonReq("POST", "/api/contacts", { displayName: "Phone Only", phone: "585-555-0100" }),
      ctx(),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.phone).toBe("585-555-0100");
    expect(body.emails).toEqual([]);
    expect(body.needsReview).toBe(false);
  });

  it("creates a contact with neither email nor phone, flagged needsReview", async () => {
    const res = await CREATE(
      jsonReq("POST", "/api/contacts", { displayName: "No Contact Info" }),
      ctx(),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.phone).toBeNull();
    expect(body.emails).toEqual([]);
    expect(body.needsReview).toBe(true);
  });

  it("does not flag needsReview when an email is given", async () => {
    const res = await CREATE(
      jsonReq("POST", "/api/contacts", {
        displayName: "Has Email",
        email: { address: "has-email@example.com" },
      }),
      ctx(),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.needsReview).toBe(false);
  });
});
