import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb } from "./helpers/db";
import { ctx } from "./helpers/http";
import { db } from "@/server/db/client";
import { contacts, staffIdentities } from "@/server/db/schema";
import { makeVolunteerContact } from "./helpers/factories";
import { createSession, SESSION_COOKIE } from "@/server/auth/session";
import { GET as LIST_EVENTS } from "@/app/api/events/route";
import { GET as LIST_CONTACTS } from "@/app/api/contacts/route";
import { GET as START_SIGNIN } from "@/app/api/auth/google/route";

/**
 * FR-004 / FR-011 / SC-002: the protection boundary, exercised through real route handlers.
 *
 * The route-inventory test (auth.routeInventory.test.ts) proves EVERY route is wrapped; this proves
 * the wrapper actually does the right thing.
 */
describe("API protection (FR-004)", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  function req(path: string, token?: string) {
    return new Request(`http://localhost${path}`, {
      headers: token ? { cookie: `${SESSION_COOKIE}=${encodeURIComponent(token)}` } : {},
    });
  }

  async function signedInToken(email = "alice@cdrochester.org") {
    const { contactId } = await makeVolunteerContact({ email });
    const [identity] = await db
      .insert(staffIdentities)
      .values({ contactId, googleSub: `sub-${contactId}` })
      .returning();
    const { token } = await createSession(db, identity!.id);
    return { token, contactId };
  }

  it("refuses an unauthenticated API request with 401", async () => {
    const res = await LIST_EVENTS(req("/api/events"), ctx());
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      error: { code: "UNAUTHENTICATED", message: "Authentication required." },
    });
  });

  it("refuses a garbage session cookie with 401", async () => {
    const res = await LIST_CONTACTS(req("/api/contacts", "not-a-real-token"), ctx());
    expect(res.status).toBe(401);
  });

  it("admits a signed-in staff member", async () => {
    const { token } = await signedInToken();
    const res = await LIST_EVENTS(req("/api/events", token), ctx());
    expect(res.status).toBe(200);
  });

  it("keeps /api/auth/* PUBLIC — otherwise sign-in would deadlock", async () => {
    const res = await START_SIGNIN(req("/api/auth/google"), ctx());
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("accounts.google.com");
  });

  // FR-011 / SC-006 — through the real protection layer, not just the session module.
  it("locks out a LIVE session the moment volunteer access is withdrawn", async () => {
    const { token, contactId } = await signedInToken();
    expect((await LIST_EVENTS(req("/api/events", token), ctx())).status).toBe(200);

    await db.update(contacts).set({ isVolunteer: false }).where(eq(contacts.id, contactId));

    // Same cookie, same unexpired session row — refused on the very next request.
    expect((await LIST_EVENTS(req("/api/events", token), ctx())).status).toBe(401);
  });

  it("does not reveal WHY access was refused", async () => {
    // "no session" and "access withdrawn" must be indistinguishable to the caller.
    const { token, contactId } = await signedInToken();
    await db.update(contacts).set({ isVolunteer: false }).where(eq(contacts.id, contactId));

    const withdrawn = await LIST_EVENTS(req("/api/events", token), ctx());
    const anonymous = await LIST_EVENTS(req("/api/events"), ctx());

    expect(withdrawn.status).toBe(anonymous.status);
    expect(await withdrawn.json()).toEqual(await anonymous.json());
  });
});
