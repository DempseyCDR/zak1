import { and, eq } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import { contactEmails, contacts, staffIdentities } from "@/server/db/schema";
import type { RefusalReason, VerifiedClaims } from "@/server/validation/auth";
import { writeAudit } from "@/server/lib/audit";
import { logger } from "@/server/lib/logger";

/**
 * Turn a verified Google identity into a staff identity (feature 015).
 *
 * The access decision, in one place:
 *   - `google_sub` is the durable binding once established (research R9).
 *   - Enrolment matches Google's verified email to an ACTIVE email on a VOLUNTEER contact (FR-014).
 *   - `contacts.is_volunteer` is the eligibility gate, read live (FR-013).
 *   - One Google account per person (FR-006).
 *
 * Refusals carry a reason for the log only — the user always sees one generic message (FR-009), because
 * distinguishing "not a volunteer" from "no such contact" would let any Google user probe membership.
 */

export type SignInResult =
  | { ok: true; identityId: string; contactId: string }
  | { ok: false; reason: RefusalReason };

function refuse(reason: RefusalReason, details: Record<string, unknown>): SignInResult {
  writeAudit({ kind: "auth.signin.refused", actor: null, details: { reason, ...details } });
  return { ok: false, reason };
}

export async function resolveSignIn(db: Db, claims: VerifiedClaims): Promise<SignInResult> {
  return db.transaction(async (tx) => {
    // 1. Known Google account → the binding wins, regardless of what email it now presents.
    const [known] = await tx
      .select()
      .from(staffIdentities)
      .where(eq(staffIdentities.googleSub, claims.sub));

    if (known) {
      const [contact] = await tx.select().from(contacts).where(eq(contacts.id, known.contactId));
      if (!contact?.isVolunteer) {
        return refuse("not_volunteer", { googleSub: claims.sub, contactId: known.contactId });
      }

      // The address changed since enrolment. Keep the sub binding — never silently re-point to
      // whatever contact the new address matches — but make it visible.
      const [loginEmail] = await tx
        .select()
        .from(contactEmails)
        .where(and(eq(contactEmails.contactId, known.contactId), eq(contactEmails.isLogin, true)));
      if (loginEmail && loginEmail.email.toLowerCase() !== claims.email.toLowerCase()) {
        logger.warn(
          { reason: "sub_email_mismatch", contactId: known.contactId, googleSub: claims.sub },
          "auth: known Google account presented a different email; keeping existing binding",
        );
      }

      await tx
        .update(staffIdentities)
        .set({ lastSignInAt: new Date() })
        .where(eq(staffIdentities.id, known.id));

      writeAudit({
        kind: "auth.signin.succeeded",
        actor: known.contactId,
        details: { identityId: known.id, contactId: known.contactId },
      });
      return { ok: true, identityId: known.id, contactId: known.contactId };
    }

    // 2. Unknown Google account → enrol by email (FR-012: no registration form, no approval step).
    const matches = await tx
      .select({ contact: contacts, emailId: contactEmails.id })
      .from(contactEmails)
      .innerJoin(contacts, eq(contacts.id, contactEmails.contactId))
      .where(and(eq(contactEmails.email, claims.email), eq(contactEmails.status, "active")));

    if (matches.length === 0) return refuse("no_match", { email: claims.email });

    // Invariant guard: `contact_emails_unique_active` (feature 001) makes an active address globally
    // unique, so this is unreachable in normal operation. Kept deliberately — if that index is ever
    // relaxed, the alternative is silently picking a contact on a security path.
    if (matches.length > 1) return refuse("ambiguous_match", { email: claims.email });

    const match = matches[0]!;
    if (!match.contact.isVolunteer) {
      return refuse("not_volunteer", { contactId: match.contact.id });
    }

    // One Google account per person. Checked BEFORE inserting so the long-term volunteer who holds
    // both a personal and a cdrochester.org account gets a clean refusal, not a UNIQUE violation.
    const [existingIdentity] = await tx
      .select()
      .from(staffIdentities)
      .where(eq(staffIdentities.contactId, match.contact.id));
    if (existingIdentity) {
      return refuse("identity_exists", {
        contactId: match.contact.id,
        existingSub: existingIdentity.googleSub,
      });
    }

    const [identity] = await tx
      .insert(staffIdentities)
      .values({ contactId: match.contact.id, googleSub: claims.sub, lastSignInAt: new Date() })
      .returning();
    if (!identity) throw new Error("staff identity insert failed");

    // Designate the matched address as the login email. Clear any other first: at most one per
    // contact (FR-015, enforced by a partial unique index).
    await tx
      .update(contactEmails)
      .set({ isLogin: false })
      .where(and(eq(contactEmails.contactId, match.contact.id), eq(contactEmails.isLogin, true)));
    await tx.update(contactEmails).set({ isLogin: true }).where(eq(contactEmails.id, match.emailId));

    writeAudit({
      kind: "auth.identity.created",
      actor: match.contact.id,
      details: { identityId: identity.id, contactId: match.contact.id },
    });
    writeAudit({
      kind: "auth.signin.succeeded",
      actor: match.contact.id,
      details: { identityId: identity.id, contactId: match.contact.id, firstSignIn: true },
    });
    return { ok: true, identityId: identity.id, contactId: match.contact.id };
  });
}
