import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb } from "./helpers/db";
import { jsonReq, ctx } from "./helpers/http";
import { POST } from "@/app/api/contacts/route";

// FR-006: provider_* metadata is read-only and rejected on write.
describe("read-only provider fields", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("rejects providerSetDate on email create with 422 READ_ONLY_FIELD", async () => {
    const res = await POST(
      jsonReq("POST", "/api/contacts", {
        displayName: "Read Only",
        email: { address: "ro@example.com", providerSetDate: "2026-01-01T00:00:00Z" },
      }),
      ctx(),
    );
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe("READ_ONLY_FIELD");
  });
});
