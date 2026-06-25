import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { jsonReq, ctx } from "./helpers/http";
import { accountMapping, mappingAudit } from "@/server/db/schema";
import { GET as GET_MAPPING } from "@/app/api/qbo-mapping/route";
import { PUT as PUT_ACCOUNT } from "@/app/api/qbo-mapping/accounts/[lineKey]/route";

// FR-006, FR-014
describe("QBO mapping config", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("returns the seeded mapping", async () => {
    const res = await GET_MAPPING(jsonReq("GET", "/api/qbo-mapping"), ctx());
    const body = await res.json();
    const adm = body.accounts.find((a: { lineKey: string }) => a.lineKey === "today_admission");
    expect(adm.accountCode).toBe("4210");
  });

  it("updates an account mapping and writes an audit entry", async () => {
    const res = await PUT_ACCOUNT(
      jsonReq("PUT", "/api/qbo-mapping/accounts/misc_sales", {
        accountCode: "4901",
        accountName: "Uncategorized Income (revised)",
      }),
      ctx({ lineKey: "misc_sales" }),
    );
    expect(res.status).toBe(200);

    const row = await db.query.accountMapping.findFirst({
      where: eq(accountMapping.lineKey, "misc_sales"),
    });
    expect(row?.accountCode).toBe("4901");

    const audits = await db.select().from(mappingAudit).where(eq(mappingAudit.key, "misc_sales"));
    expect(audits.length).toBe(1);
  });

  it("404s for an unknown line key", async () => {
    const res = await PUT_ACCOUNT(
      jsonReq("PUT", "/api/qbo-mapping/accounts/bogus", { accountCode: "1", accountName: "x" }),
      ctx({ lineKey: "bogus" }),
    );
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("MAPPING_KEY_NOT_FOUND");
  });
});
