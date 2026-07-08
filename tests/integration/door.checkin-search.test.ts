import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb } from "./helpers/db";
import { jsonReq, ctx } from "./helpers/http";
import { POST as CREATE_CONTACT } from "@/app/api/contacts/route";
import { GET as SEARCH } from "@/app/api/attendance/search/route";

// FR-001, FR-002
describe("GET /api/attendance/search", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("returns ranked candidates with emails for disambiguation", async () => {
    await CREATE_CONTACT(
      jsonReq("POST", "/api/contacts", {
        firstName: "Ada Lovelace",
        email: { address: "ada@example.com" },
      }),
      ctx(),
    );
    const res = await SEARCH(jsonReq("GET", "/api/attendance/search?q=ada%20lovelace"), ctx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items[0].displayName).toBe("Ada Lovelace");
    expect(body.items[0].emails).toContain("ada@example.com");
  });
});
