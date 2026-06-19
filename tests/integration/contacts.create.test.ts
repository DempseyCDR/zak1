import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb } from "./helpers/db";
import { jsonReq, ctx } from "./helpers/http";
import { POST } from "@/app/api/contacts/route";

// FR-001, FR-003
describe("POST /api/contacts", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("creates a contact with status 'never' and a stable id", async () => {
    const res = await POST(
      jsonReq("POST", "/api/contacts", {
        displayName: "Ada Lovelace",
        email: { address: "ada@example.com" },
      }),
      ctx(),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toMatch(/[0-9a-f-]{36}/);
    expect(body.membershipStatus).toBe("never");
    expect(body.listMember).toBe(false);
    expect(body.emails).toHaveLength(1);
    expect(body.emails[0].email).toBe("ada@example.com");
  });

  it("rejects a duplicate active email with 409 EMAIL_DUPLICATE", async () => {
    await POST(
      jsonReq("POST", "/api/contacts", {
        displayName: "First",
        email: { address: "dup@example.com" },
      }),
      ctx(),
    );
    const res = await POST(
      jsonReq("POST", "/api/contacts", {
        displayName: "Second",
        email: { address: "DUP@example.com" }, // case-insensitive match
      }),
      ctx(),
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("EMAIL_DUPLICATE");
  });
});
