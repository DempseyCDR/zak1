import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb } from "./helpers/db";
import { db } from "@/server/db/client";
import { contacts, staffIdentities, staffSessions } from "@/server/db/schema";
import { makeVolunteerContact } from "./helpers/factories";
import { createSession, destroySession, readSession } from "@/server/auth/session";

/**
 * FR-002 / FR-007 / FR-008 / FR-011: the session lifecycle.
 *
 * Sessions are DB rows precisely so the revocation test below can pass — a stateless token could not
 * be revoked before expiry.
 */
describe("staff sessions", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  /** Sessions belonging to one identity — the harness seeds a standing session of its own. */
  async function sessionsFor(identityId: string) {
    return db.select().from(staffSessions).where(eq(staffSessions.staffIdentityId, identityId));
  }

  async function makeIdentity(email = "alice@cdrochester.org") {
    const { contactId } = await makeVolunteerContact({ email });
    const [identity] = await db
      .insert(staffIdentities)
      .values({ contactId, googleSub: `sub-${contactId}` })
      .returning();
    return { contactId, identityId: identity!.id };
  }

  it("creates a session and resolves it back to the staff member", async () => {
    const { contactId, identityId } = await makeIdentity();
    const { token } = await createSession(db, identityId);

    const staff = await readSession(db, token);
    expect(staff).toMatchObject({ identityId, contactId, displayName: "Vol Unteer" });
  });

  it("stores only a HASH of the token, never the token itself", async () => {
    const { identityId } = await makeIdentity();
    const { token } = await createSession(db, identityId);

    const [row] = await sessionsFor(identityId);
    expect(row?.tokenHash).toBeTruthy();
    expect(row?.tokenHash).not.toBe(token);
    expect(JSON.stringify(row)).not.toContain(token);
  });

  it("returns null for an unknown or absent token", async () => {
    expect(await readSession(db, undefined)).toBeNull();
    expect(await readSession(db, "not-a-real-token")).toBeNull();
  });

  // FR-007 / SC-004
  it("extends the rolling window on each read", async () => {
    const { identityId } = await makeIdentity();
    const { token } = await createSession(db, identityId);
    const before = (await sessionsFor(identityId))[0]!;

    // Wind the clock back so the extension is observable.
    const earlier = new Date(Date.now() - 60_000);
    await db
      .update(staffSessions)
      .set({ lastSeenAt: earlier, expiresAt: new Date(Date.now() + 1_000) })
      .where(eq(staffSessions.id, before.id));

    expect(await readSession(db, token)).not.toBeNull();

    const after = (await sessionsFor(identityId))[0]!;
    expect(after.lastSeenAt.getTime()).toBeGreaterThan(earlier.getTime());
    expect(after.expiresAt.getTime()).toBeGreaterThan(Date.now() + 60_000);
  });

  // FR-008
  it("treats an idled-out session as unauthenticated", async () => {
    const { identityId } = await makeIdentity();
    const { token } = await createSession(db, identityId);
    await db
      .update(staffSessions)
      .set({ expiresAt: new Date(Date.now() - 1_000) })
      .where(eq(staffSessions.staffIdentityId, identityId));

    expect(await readSession(db, token)).toBeNull();
  });

  // FR-002
  it("sign-out deletes the session row", async () => {
    const { identityId } = await makeIdentity();
    const { token } = await createSession(db, identityId);

    await destroySession(db, token);

    expect(await sessionsFor(identityId)).toHaveLength(0);
    expect(await readSession(db, token)).toBeNull();
  });

  it("sign-out is idempotent for an unknown token", async () => {
    await expect(destroySession(db, "nope")).resolves.toBeUndefined();
  });

  // FR-011 / SC-006 — the scenario a stateless JWT could not satisfy.
  it("refuses a LIVE session the moment volunteer access is withdrawn", async () => {
    const { contactId, identityId } = await makeIdentity();
    const { token } = await createSession(db, identityId);
    expect(await readSession(db, token)).not.toBeNull();

    await db.update(contacts).set({ isVolunteer: false }).where(eq(contacts.id, contactId));

    // No session row deleted, nothing expired — the live is_volunteer join does the work.
    expect(await readSession(db, token)).toBeNull();
    expect(await sessionsFor(identityId)).toHaveLength(1);
  });

  it("restoring volunteer access restores the still-valid session", async () => {
    const { contactId, identityId } = await makeIdentity();
    const { token } = await createSession(db, identityId);
    await db.update(contacts).set({ isVolunteer: false }).where(eq(contacts.id, contactId));
    expect(await readSession(db, token)).toBeNull();

    await db.update(contacts).set({ isVolunteer: true }).where(eq(contacts.id, contactId));
    expect(await readSession(db, token)).not.toBeNull();
  });
});
