import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { makeContactWithEmail } from "./helpers/factories";
import { buildListRows } from "@/server/domain/exports/exportService";

// FR-002, FR-002a, FR-003, FR-004, SC-004
describe("buildListRows — member", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("includes a current member with the membership_status column", async () => {
    await makeContactWithEmail({
      displayName: "Grace Hopper",
      email: "grace@example.com",
      listMember: true,
      membershipStatus: "current",
    });
    const rows = await buildListRows(db, "member");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.membership_status).toBe("current");
  });

  it("includes lapsed and long_lapsed members, excludes never", async () => {
    await makeContactWithEmail({
      email: "lapsed@example.com",
      listMember: true,
      membershipStatus: "lapsed",
    });
    await makeContactWithEmail({
      email: "long-lapsed@example.com",
      listMember: true,
      membershipStatus: "long_lapsed",
    });
    await makeContactWithEmail({
      email: "never@example.com",
      listMember: false,
      membershipStatus: "never",
    });
    const rows = await buildListRows(db, "member");
    expect(rows.map((r) => r.email).sort()).toEqual([
      "lapsed@example.com",
      "long-lapsed@example.com",
    ]);
  });

  it("excludes an email explicitly carrying Do Not Contact even though list_member is true", async () => {
    await makeContactWithEmail({
      email: "dnc-member@example.com",
      listMember: true,
      membershipStatus: "current",
      consentTopics: ["do_not_contact"],
    });
    const rows = await buildListRows(db, "member");
    expect(rows).toHaveLength(0);
  });

  it("excludes a transition/inactive email even when list_member is true", async () => {
    await makeContactWithEmail({
      email: "transition-member@example.com",
      listMember: true,
      membershipStatus: "current",
      emailStatus: "transition",
    });
    const rows = await buildListRows(db, "member");
    expect(rows).toHaveLength(0);
  });
});
