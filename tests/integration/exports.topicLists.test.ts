import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { makeContactWithEmail } from "./helpers/factories";
import { buildListRows } from "@/server/domain/exports/exportService";

// FR-001a, FR-002, FR-002a, FR-003
describe("buildListRows — topic lists", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("includes an active email carrying the list's consent topic", async () => {
    await makeContactWithEmail({
      displayName: "Ada Lovelace",
      email: "ada@example.com",
      consentTopics: ["contra"],
    });
    const rows = await buildListRows(db, "contra");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.email).toBe("ada@example.com");
    expect(rows[0]?.first_name).toBe("Ada");
    expect(rows[0]?.last_name).toBe("Lovelace");
  });

  it("excludes an email not carrying the list's topic", async () => {
    await makeContactWithEmail({ email: "no-topic@example.com", consentTopics: ["english"] });
    const rows = await buildListRows(db, "contra");
    expect(rows).toHaveLength(0);
  });

  it("excludes an email whose only topic is Do Not Contact (implicit)", async () => {
    await makeContactWithEmail({ email: "dnc@example.com", consentTopics: ["do_not_contact"] });
    const rows = await buildListRows(db, "contra");
    expect(rows).toHaveLength(0);
  });

  it("excludes transition and inactive emails", async () => {
    await makeContactWithEmail({
      email: "transition@example.com",
      consentTopics: ["contra"],
      emailStatus: "transition",
    });
    await makeContactWithEmail({
      email: "inactive@example.com",
      consentTopics: ["contra"],
      emailStatus: "inactive",
    });
    const rows = await buildListRows(db, "contra");
    expect(rows).toHaveLength(0);
  });

  it("scopes the special-events and JAB list ids to their underscored consent topics", async () => {
    await makeContactWithEmail({ email: "se@example.com", consentTopics: ["special_events"] });
    await makeContactWithEmail({ email: "jab@example.com", consentTopics: ["jane_austen_ball"] });
    expect(await buildListRows(db, "specialevents")).toHaveLength(1);
    expect(await buildListRows(db, "janeaustenball")).toHaveLength(1);
  });
});
