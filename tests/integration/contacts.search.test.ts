import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { contacts } from "@/server/db/schema";
import { contactRow } from "./helpers/factories";
import { createContact, searchContacts } from "@/server/domain/contacts/contactService";

// Feature 061 (X-R3): substring-primary, monotonic search across name ∪ dedup ∪ email; typo-tolerant
// fuzzy fallback only when exact matches are thin; { items, truncated } result. Real-Postgres.

const names = async (q: string, limit?: number): Promise<string[]> => {
  const { items } = await searchContacts(db, q, limit);
  return items.map((r) => r.displayName);
};

describe("contact search", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("returns the best match for a partial name (result shape { items })", async () => {
    await db
      .insert(contacts)
      .values([contactRow("Ada Lovelace"), contactRow("Adam Smith"), contactRow("Grace Hopper")]);
    const { items, truncated } = await searchContacts(db, "ada lovelace");
    expect(items.length).toBeGreaterThan(0);
    expect(items[0]?.displayName).toBe("Ada Lovelace");
    expect(truncated).toBe(false);
  });

  // US1 / SC-001 — substring/prefix: "cat" finds "Catherine" (the old trigram matcher returned nothing).
  it("finds a contact by a short prefix (SC-001: 'cat' → Catherine)", async () => {
    await db.insert(contacts).values([contactRow("Catherine Jones"), contactRow("Grace Hopper")]);
    expect(await names("cat")).toContain("Catherine Jones");
  });

  // US1 / SC-002 — monotonic narrowing: each longer query is a subset of the shorter.
  it("narrows monotonically (SC-002: cath ⊇ cathe ⊇ cather)", async () => {
    await db
      .insert(contacts)
      .values([
        contactRow("Cathy McGrath"),
        contactRow("Catherine Jones"),
        contactRow("Catherine Hughes"),
        contactRow("Catherine Sloboda"),
      ]);
    const cath = new Set(await names("cath"));
    const cathe = new Set(await names("cathe"));
    const cather = new Set(await names("cather"));
    expect([...cathe].every((n) => cath.has(n))).toBe(true); // cathe ⊆ cath
    expect([...cather].every((n) => cathe.has(n))).toBe(true); // cather ⊆ cathe
    expect(cath.has("Cathy McGrath")).toBe(true);
    expect(cathe.has("Cathy McGrath")).toBe(false); // "cathy" has no "cathe"
  });

  // US1 / SC-004 — truncation is signalled when more matches exist than the limit.
  it("signals truncation when matches exceed the limit (SC-004)", async () => {
    await db
      .insert(contacts)
      .values([contactRow("Sam Smith"), contactRow("Sammy Smart"), contactRow("Samuel Small")]);
    const capped = await searchContacts(db, "sam", 2);
    expect(capped.items).toHaveLength(2);
    expect(capped.truncated).toBe(true);
    const full = await searchContacts(db, "sam", 20);
    expect(full.truncated).toBe(false);
  });

  // US2 / SC-003 — a display-name override is still findable by the effective display name...
  it("finds a contact by its display-name override", async () => {
    await createContact(db, {
      firstName: "Robert",
      lastName: "Frost",
      displayNameOverride: "Bob Frost",
    });
    expect(await names("Bob")).toContain("Bob Frost");
  });

  // US2 / SC-003 — ...AND by their real first/last name even when a display override hides it.
  it("finds an overridden contact by real first and last name (via dedup key)", async () => {
    await createContact(db, {
      firstName: "David",
      lastName: "Jones",
      displayNameOverride: "DJ",
    });
    expect(await names("David")).toContain("DJ");
    expect(await names("Jones")).toContain("DJ");
  });

  // US2 / SC-003 — find a contact by a prefix of one of their emails.
  it("finds a contact by an email prefix", async () => {
    await createContact(db, {
      firstName: "Xavier",
      email: {
        address: "unrelated@example.com",
        purposes: ["personal"],
        consentTopics: ["contact_tracing"],
        status: "active",
        isLogin: false,
      },
    });
    // "unrelated" matches nothing in the name — only the email.
    expect(await names("unrelated@ex")).toContain("Xavier");
  });

  // US3 / SC — fuzzy fallback ONLY when exact matches are thin, ranked after exact.
  it("adds a close spelling variant when exact matches are thin (fuzzy fallback)", async () => {
    await db.insert(contacts).values([contactRow("Katherine")]);
    // No "Catherine" exists → primary substring is empty → fuzzy surfaces "Katherine".
    expect(await names("catherine")).toContain("Katherine");
  });

  it("does NOT add the fuzzy variant when exact matches are plentiful", async () => {
    await db
      .insert(contacts)
      .values([
        contactRow("Katherine"),
        contactRow("Catherine One"),
        contactRow("Catherine Two"),
        contactRow("Catherine Three"),
        contactRow("Catherine Four"),
        contactRow("Catherine Five"),
        contactRow("Catherine Six"),
      ]);
    const res = await names("catherine");
    expect(res).not.toContain("Katherine");
    expect(res).toContain("Catherine One");
  });

  it("meets the 300ms p95 target at ~1,300 contacts", async () => {
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
    const rows = Array.from({ length: 1300 }, (_, i) =>
      contactRow(`${first[i % first.length]} ${last[(i * 3) % last.length]} ${i}`),
    );
    for (let i = 0; i < rows.length; i += 500) {
      await db.insert(contacts).values(rows.slice(i, i + 500));
    }
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
