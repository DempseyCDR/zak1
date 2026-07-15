import { randomBytes, createHash } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import { contactEmails, contacts, staffIdentities, staffSessions } from "@/server/db/schema";
import { getEnv } from "@/server/validation/env";
import { writeAudit } from "@/server/lib/audit";

/**
 * Server-side staff sessions (feature 015).
 *
 * DB-backed rather than a stateless token because FR-011 requires that withdrawing a volunteer's
 * access ends an ACTIVE session — a JWT could not be revoked before its expiry.
 *
 * The cookie carries an opaque random token; only its HASH is stored, so a database leak yields no
 * usable sessions. This module deals in tokens, never cookies: HTTP concerns live in the routes.
 */

export const SESSION_COOKIE = "zak1_staff_session";

/** The signed-in staff member. Identity ONLY — roles/scopes are P3-2's job (FR-005). */
export type CurrentStaff = {
  identityId: string;
  contactId: string;
  displayName: string;
  email: string;
};

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function idleTtlMs(): number {
  return getEnv().SESSION_IDLE_TTL_HOURS * 60 * 60 * 1000;
}

export type CreatedSession = { token: string; expiresAt: Date };

/** Issue a session for a staff identity. Returns the RAW token — store it in the cookie only. */
export async function createSession(db: Db, identityId: string): Promise<CreatedSession> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + idleTtlMs());
  await db
    .insert(staffSessions)
    .values({ staffIdentityId: identityId, tokenHash: hashToken(token), expiresAt });
  return { token, expiresAt };
}

/**
 * Resolve a raw session token to the signed-in staff member, or null.
 *
 * Enforces expiry AND re-checks `contacts.is_volunteer` on every call via a live join — that join is
 * what makes FR-011 work: a withdrawn volunteer is locked out on their next request, with no
 * revocation sweep and no stored copy of eligibility to go stale.
 *
 * Rolling window: a valid read extends `last_seen_at`/`expires_at` (FR-007/FR-008).
 */
export async function readSession(db: Db, token: string | undefined): Promise<CurrentStaff | null> {
  if (!token) return null;

  const [row] = await db
    .select({
      sessionId: staffSessions.id,
      identityId: staffIdentities.id,
      contactId: contacts.id,
      displayName: contacts.displayName,
      isVolunteer: contacts.isVolunteer,
    })
    .from(staffSessions)
    .innerJoin(staffIdentities, eq(staffIdentities.id, staffSessions.staffIdentityId))
    .innerJoin(contacts, eq(contacts.id, staffIdentities.contactId))
    .where(and(eq(staffSessions.tokenHash, hashToken(token)), gt(staffSessions.expiresAt, new Date())));

  if (!row) return null;
  // Access withdrawn since sign-in: refuse immediately (FR-011).
  if (!row.isVolunteer) return null;

  const now = new Date();
  await db
    .update(staffSessions)
    .set({ lastSeenAt: now, expiresAt: new Date(now.getTime() + idleTtlMs()) })
    .where(eq(staffSessions.id, row.sessionId));

  const email = await loginEmailFor(db, row.contactId);
  return {
    identityId: row.identityId,
    contactId: row.contactId,
    displayName: row.displayName,
    email,
  };
}

async function loginEmailFor(db: Db, contactId: string): Promise<string> {
  const [row] = await db
    .select({ email: contactEmails.email })
    .from(contactEmails)
    .where(and(eq(contactEmails.contactId, contactId), eq(contactEmails.isLogin, true)));
  return row?.email ?? "";
}

/** End a session (FR-002). Idempotent: an unknown token is a no-op. */
export async function destroySession(db: Db, token: string | undefined): Promise<void> {
  if (!token) return;
  const deleted = await db
    .delete(staffSessions)
    .where(eq(staffSessions.tokenHash, hashToken(token)))
    .returning({ id: staffSessions.id });
  if (deleted.length > 0) {
    writeAudit({ kind: "auth.signout", actor: null, details: { sessions: deleted.length } });
  }
}
