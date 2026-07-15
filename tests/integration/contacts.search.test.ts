import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { contacts } from "@/server/db/schema";
import { contactRow } from "./helpers/factories";
import { createContact, searchContacts } from "@/server/domain/contacts/contactService";

// FR-001 (fuzzy search) + SC-005 (perf at ~1,300 contacts within 300ms p95)
describe("fuzzy name search", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  async function seed(n: number) {
    const first = ["Ada", "Grace", "Alan", "Katherine", "Dorothy", "Edsger", "Donald", "Barbara"];
    const last = [
      "Lovelace",
      "Hopper",
      "Turing",
      "Johnson",
      "Vaughan",
      "Dijkstra",
      "Knuth",
      "Liskov",
    ];
    const rows = Array.from({ length: n }, (_, i) => {
      const name = `${first[i % first.length]} ${last[(i * 3) % last.length]} ${i}`;
      return contactRow(name);
    });
    // bulk insert in chunks
    for (let i = 0; i < rows.length; i += 500) {
      await db.insert(contacts).values(rows.slice(i, i + 500));
    }
  }

  it("returns ranked matches for a partial name", async () => {
    await db
      .insert(contacts)
      .values([contactRow("Ada Lovelace"), contactRow("Adam Smith"), contactRow("Grace Hopper")]);
    const results = await searchContacts(db, "ada lovelace");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.displayName).toBe("Ada Lovelace");
  });

  // FR-006, SC-006 — search matches the effective display name, so a nickname override is findable.
  it("finds a contact by its display-name override", async () => {
    await createContact(db, {
      firstName: "Robert",
      lastName: "Frost",
      displayNameOverride: "Bob Frost",
    });
    const results = await searchContacts(db, "Bob");
    expect(results.some((r) => r.displayName === "Bob Frost")).toBe(true);
  });

  it("meets the 300ms p95 target at ~1,300 contacts", async () => {
    await seed(1300);
    const samples: number[] = [];
    for (let i = 0; i < 20; i++) {
      const t = performance.now();
      await searchContacts(db, "grace hopper");
      samples.push(performance.now() - t);
    }
    samples.sort((a, b) => a - b);
    const p95 = samples[Math.floor(samples.length * 0.95) - 1] ?? samples[samples.length - 1]!;
    expect(p95).toBeLessThan(300);
  });
});
