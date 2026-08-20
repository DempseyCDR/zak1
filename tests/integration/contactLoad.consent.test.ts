import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { icontactCsv, memberCsv, payerCsv } from "./helpers/contactLoadCsv";
import { contactEmails } from "@/server/db/schema";
import { parseIcontact } from "@/server/domain/contactLoad/parseIcontact";
import { parseMemberSheet } from "@/server/domain/contactLoad/parseMemberSheet";
import { parsePayerSheet } from "@/server/domain/contactLoad/parsePayerSheet";
import { executeContactLoad } from "@/server/domain/contactLoad/execute";
import type { IcRow } from "./helpers/contactLoadCsv";

function run(icontact: IcRow[]) {
  return executeContactLoad(
    db,
    {
      icontact: parseIcontact(icontactCsv(icontact)),
      members: parseMemberSheet(memberCsv([])),
      payers: parsePayerSheet(payerCsv([])),
    },
    { dryRun: false },
  );
}
async function topics(email: string) {
  const [row] = await db.select().from(contactEmails).where(eq(contactEmails.email, email));
  return row!;
}

describe("contact load — email consent permissions (US2)", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("maps 1→subscribed, treats blank/-1 identically, and always adds contact_tracing", async () => {
    await run([
      { email: "a@x.com", fname: "Ann", lname: "Lee", contra: "1", english: "" },
      {
        email: "b@x.com",
        fname: "Bo",
        lname: "Fab",
        contra: "1",
        english: "-1",
        openband: "1",
        specialevents: "1",
        jab: "2,025",
        lastopen: "08-20-2026 10:30:13",
      },
    ]);
    expect((await topics("a@x.com")).consentTopics.sort()).toEqual(["contact_tracing", "contra"]);
    // english=-1 is NOT subscribed (same as blank); contra=1/openband=1/specialevents=1/jab are
    expect((await topics("b@x.com")).consentTopics.sort()).toEqual([
      "contact_tracing",
      "contra",
      "jane_austen_ball",
      "openband",
      "special_events",
    ]);
    expect((await topics("b@x.com")).providerLastOpen?.toISOString()).toBe(
      "2026-08-20T10:30:13.000Z",
    );
  });

  it("keeps per-email topics when one contact has several emails", async () => {
    await run([
      { email: "m1@x.com", fname: "Multi", lname: "Mail", contra: "1" },
      { email: "m2@x.com", fname: "Multi", lname: "Mail", english: "1" },
    ]);
    const e1 = await topics("m1@x.com");
    const e2 = await topics("m2@x.com");
    expect(e1.contactId).toBe(e2.contactId); // one contact
    expect(e1.consentTopics.sort()).toEqual(["contact_tracing", "contra"]);
    expect(e2.consentTopics.sort()).toEqual(["contact_tracing", "english"]);
  });
});
