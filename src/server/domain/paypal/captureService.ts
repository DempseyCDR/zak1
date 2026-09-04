import { and, desc, eq, sql } from "drizzle-orm";
import type { Db, DbOrTx } from "@/server/db/client";
import {
  contactEmails,
  membershipCaptures,
  paypalNotifications,
  contacts,
} from "@/server/db/schema";
import type { MembershipCaptureRow } from "@/server/db/schema";
import { writeAudit } from "@/server/lib/audit";
import { recordDuesPayment } from "@/server/domain/membership/accountService";
import type { ExtractedNotification } from "@/server/validation/paypal";

/**
 * Feature 019 US3 (FR-010): store a public capture, awaiting a matched PayPal notification. When several
 * awaiting captures share an email, the latest wins — so an earlier one is expired here (kept tidy; the
 * matcher also selects the newest). Inert until a verified payment arrives.
 */
export async function createCapture(
  db: Db,
  input: { name: string; email: string },
): Promise<MembershipCaptureRow> {
  return db.transaction(async (tx) => {
    // Supersede older awaiting captures for the same email (US3 latest-wins, analyze U2).
    await tx
      .update(membershipCaptures)
      .set({ status: "expired" })
      .where(
        and(
          eq(sql`lower(${membershipCaptures.email})`, input.email.toLowerCase()),
          eq(membershipCaptures.status, "awaiting_payment"),
        ),
      );
    // Resolve to an EXISTING contact by active email (citext, case-insensitive). A renewing member links
    // now and auto-enrolls on payment; a brand-new person stays contactId-null and is parked for an admin
    // to create the contact and complete enrollment (spec parking fallback).
    const existingEmail = await tx.query.contactEmails.findFirst({
      where: and(eq(contactEmails.email, input.email), eq(contactEmails.status, "active")),
    });
    const [row] = await tx
      .insert(membershipCaptures)
      .values({ name: input.name, email: input.email, contactId: existingEmail?.contactId ?? null })
      .returning();
    if (!row) throw new Error("capture insert failed");
    return row;
  });
}

/** FR-011: the parked-payment worklist for the admin linking screen. */
export async function listParkedNotifications(
  db: Db,
): Promise<{ id: string; payerEmail: string | null; amountCents: number; receivedAt: Date }[]> {
  return db
    .select({
      id: paypalNotifications.id,
      payerEmail: paypalNotifications.payerEmail,
      amountCents: paypalNotifications.amountCents,
      receivedAt: paypalNotifications.receivedAt,
    })
    .from(paypalNotifications)
    .where(eq(paypalNotifications.status, "parked"))
    .orderBy(desc(paypalNotifications.receivedAt));
}

export type NotificationOutcome = "rejected" | "duplicate" | "matched" | "parked";

/**
 * Feature 019 US3 (FR-011..FR-013): process a notification whose authenticity has ALREADY been decided by
 * the caller (`verified` — the injectable seam; tests pass it directly, the route computes it via
 * verifyPaypalWebhook). Order is the contract (contracts/paypal-webhook.md):
 *   verify → insert-or-duplicate → match-by-email → create membership / park.
 * Insert + match run in one transaction. Idempotency is the DB unique on provider_event_id (FR-013), not
 * an application check. A verified-but-unmatched payment is PARKED, never dropped; an unverifiable one is
 * REJECTED and nothing is stored (storing unverified payloads would make this an unauthenticated write).
 */
export async function processNotification(
  db: Db,
  n: ExtractedNotification,
  rawPayload: unknown,
  verified: boolean,
  actor: string | null = null,
): Promise<NotificationOutcome> {
  if (!verified) {
    writeAudit({
      kind: "paypal.notification.rejected",
      actor,
      details: { providerEventId: n.providerEventId, reason: "verification_failed" },
    });
    return "rejected";
  }

  // Idempotency (FR-013): a replay collides on the unique provider_event_id and is discarded.
  const existing = await db.query.paypalNotifications.findFirst({
    where: eq(paypalNotifications.providerEventId, n.providerEventId),
  });
  if (existing) return "duplicate";

  const capture = n.payerEmail
    ? await db.query.membershipCaptures.findFirst({
        where: and(
          eq(sql`lower(${membershipCaptures.email})`, n.payerEmail.toLowerCase()),
          eq(membershipCaptures.status, "awaiting_payment"),
        ),
        orderBy: [desc(membershipCaptures.createdAt)], // latest capture wins (analyze U2)
      })
    : undefined;
  // "Matched" requires a capture we can actually enroll — i.e. one already linked to a contact. A capture
  // that matched the email but has no contact (a brand-new person) is PARKED so an admin creates the
  // contact and links it. Everything not cleanly enrollable is parked, never dropped (FR-011).
  const enrollable =
    capture && capture.contactId
      ? ({ ...capture, contactId: capture.contactId } as MembershipCaptureRow & {
          contactId: string;
        })
      : null;

  return db.transaction(async (tx) => {
    const [notif] = await tx
      .insert(paypalNotifications)
      .values({
        providerEventId: n.providerEventId,
        eventType: n.eventType,
        payerEmail: n.payerEmail,
        amountCents: n.amountCents,
        captureId: capture?.id ?? null,
        status: enrollable ? "matched" : "parked",
        rawPayload: rawPayload as object,
      })
      .returning();
    if (!notif) throw new Error("notification insert failed");

    if (!enrollable) {
      writeAudit({
        kind: "paypal.notification.parked",
        actor,
        details: {
          notificationId: notif.id,
          payerEmail: n.payerEmail,
          captureId: capture?.id ?? null,
        },
      });
      return "parked";
    }

    await enrollFromCapture(tx, enrollable, notif.id, actor);
    await tx
      .update(membershipCaptures)
      .set({ status: "matched" })
      .where(eq(membershipCaptures.id, enrollable.id));
    return "matched";
  });
}

/**
 * Link a parked notification to a contact by hand (FR-011 manual fallback) and enroll the membership. The
 * admin supplies the contact; reuses the shared creation path so an admin-linked payment is identical to
 * an auto-matched one.
 */
export async function linkParkedNotification(
  db: Db,
  notificationId: string,
  contactId: string,
  actor: string | null = null,
): Promise<void> {
  await db.transaction(async (tx) => {
    const notif = await tx.query.paypalNotifications.findFirst({
      where: eq(paypalNotifications.id, notificationId),
    });
    if (!notif) throw new Error("notification not found");
    const contact = await tx.query.contacts.findFirst({ where: eq(contacts.id, contactId) });
    if (!contact) throw new Error("contact not found");
    // Feature 068: dues open or renew the payer's ACCOUNT. This path is REACHABLE TODAY — it is the
    // parked-payment link on /payments — unlike the dormant webhook enrolment below.
    await recordDuesPayment(
      tx as unknown as Db,
      contactId,
      { level: "individual", paymentDate: new Date().toISOString().slice(0, 10) },
      // `actor` here is free text from the legacy x-actor header, not a contact id, so it cannot be the
      // durable audit actor. The linking action itself is still attributed below via writeAudit.
      null,
    );
    await tx
      .update(paypalNotifications)
      .set({ status: "resolved" })
      .where(eq(paypalNotifications.id, notif.id));
    writeAudit({
      kind: "paypal.notification.linked",
      actor,
      details: { notificationId: notif.id, contactId },
    });
  });
}

/**
 * Create/renew the membership for a matched capture (already known to carry a contact), tied to its
 * notification, via the shared creation path (FR-012 — same routine as the door flow).
 */
async function enrollFromCapture(
  tx: DbOrTx,
  capture: MembershipCaptureRow & { contactId: string },
  notificationId: string,
  actor: string | null,
): Promise<void> {
  // Feature 068: the account model. This path is DORMANT — the webhook has never delivered, because the
  // app is not deployed and PayPal has no address to POST to — but it must keep compiling and behaving.
  // Replay protection is unchanged: `paypal_notifications.provider_event_id` is UNIQUE and checked before
  // anything is created, which is what the retired per-membership source index was a second belt on.
  await recordDuesPayment(
    tx as unknown as Db,
    capture.contactId,
    { level: "individual", paymentDate: new Date().toISOString().slice(0, 10) },
    null, // see above: the legacy free-text actor is not a contact id
  );
  void notificationId;
  writeAudit({
    kind: "membership.online_enrollment",
    actor,
    details: { notificationId, contactId: capture.contactId, captureId: capture.id },
  });
}
