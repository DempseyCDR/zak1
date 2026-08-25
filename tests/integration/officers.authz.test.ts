import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { jsonReq, jsonReqAs, ctx } from "./helpers/http";
import { makeActor } from "./helpers/factories";
import { contactRow } from "./helpers/factories";
import { contacts } from "@/server/db/schema";
import { POST } from "@/app/api/officers/route";

// Feature 055 (P7-R12): officer assignment is default-deny — content.write only. The standing jsonReq session
// is a super_user (holds content.write) for the allow case.
describe("officers POST requires content.write", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  async function aContact(): Promise<string> {
    const [row] = await db.insert(contacts).values(contactRow("Jane Doe")).returning();
    return row!.id;
  }

  it("refuses a base-only actor — 403 naming content.write", async () => {
    const contactId = await aContact();
    const { token } = await makeActor({
      email: "nope@cdrochester.org",
      grants: [{ role: "door_attendant" }], // no content.write
    });
    const res = await POST(
      jsonReqAs(token, "POST", "/api/officers", { roleKey: "treasurer", contactId }),
      ctx(),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(body.error.message).toContain("content.write");
  });

  it("allows a content.write actor", async () => {
    const contactId = await aContact();
    const res = await POST(
      jsonReq("POST", "/api/officers", { roleKey: "treasurer", contactId }),
      ctx(),
    );
    expect(res.status).toBe(200);
  });
});
