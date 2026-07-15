import { and, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { contactEmails, contacts } from "@/server/db/schema";
import type { VolunteerRole } from "@/server/db/schema";
import { writeAudit } from "@/server/lib/audit";
import { loadEnv } from "@/server/lib/loadEnv";

/**
 * Operator bootstrap for the first officer (feature 015, FR-017 / SC-008).
 *
 * Nothing else in the app can grant staff access: no UI sets `contacts.is_volunteer`, and sign-in
 * requires a volunteer contact holding an active email that matches the Google account. Without this
 * the feature cannot be bootstrapped at all.
 *
 * Deliberately NOT an HTTP endpoint — an unauthenticated privilege-granting route would be a hole.
 * Designating *other* volunteers and assigning roles is out of scope here; that is P3-2's job (FR-018).
 *
 * ⚠️ This is NOT `db:seed`. It only ever touches the one named contact; it never truncates anything.
 */

export type BootstrapOptions = {
  /** The person's Google/Workspace login address. */
  email: string;
  /** Required when the address is not yet on the contact — attaches it. */
  contactId?: string;
  /** Optional volunteer role to grant (e.g. "administrator"). */
  role?: VolunteerRole;
};

export type BootstrapResult = {
  contactId: string;
  displayName: string;
  email: string;
  /** False when the contact was already fully designated (idempotent re-run). */
  changed: boolean;
};

export async function bootstrapOfficer(opts: BootstrapOptions): Promise<BootstrapResult> {
  const email = opts.email.trim();
  if (!email) throw new Error("bootstrap: --email is required");

  return db.transaction(async (tx) => {
    let contactId: string;

    if (opts.contactId) {
      const [c] = await tx.select().from(contacts).where(eq(contacts.id, opts.contactId));
      if (!c) throw new Error(`bootstrap: no contact with id ${opts.contactId}`);
      contactId = c.id;
    } else {
      // Match by email (citext — case-insensitive). Must be unambiguous: never guess.
      const matches = await tx
        .select({ contactId: contactEmails.contactId })
        .from(contactEmails)
        .where(eq(contactEmails.email, email));
      const distinct = [...new Set(matches.map((m) => m.contactId))];
      if (distinct.length === 0) {
        throw new Error(
          `bootstrap: no contact has the email ${email}. If this is a new Workspace address, ` +
            `re-run with --contact-id <uuid> to attach it to an existing contact.`,
        );
      }
      if (distinct.length > 1) {
        throw new Error(
          `bootstrap: ambiguous — ${email} is on ${distinct.length} contacts. ` +
            `Resolve the duplicate (see /dedup) or re-run with --contact-id <uuid>.`,
        );
      }
      contactId = distinct[0]!;
    }

    const [contact] = await tx.select().from(contacts).where(eq(contacts.id, contactId));
    if (!contact) throw new Error(`bootstrap: no contact with id ${contactId}`);

    let changed = false;

    // 1. Designate as a volunteer — the eligibility gate for holding a login email and signing in.
    if (!contact.isVolunteer) {
      await tx.update(contacts).set({ isVolunteer: true }).where(eq(contacts.id, contactId));
      changed = true;
    }

    // 2. Optionally grant a role (the CHECK constraint requires is_volunteer first, set above).
    if (opts.role && !contact.volunteerRoles.includes(opts.role)) {
      await tx
        .update(contacts)
        .set({ volunteerRoles: [...contact.volunteerRoles, opts.role] })
        .where(eq(contacts.id, contactId));
      changed = true;
    }

    // 3. Ensure the address exists as an ACTIVE email on this contact.
    const [existing] = await tx
      .select()
      .from(contactEmails)
      .where(and(eq(contactEmails.contactId, contactId), eq(contactEmails.email, email)));

    if (!existing) {
      await tx.insert(contactEmails).values({
        contactId,
        email,
        status: "active",
        isLogin: true,
      });
      changed = true;
    } else {
      if (existing.status !== "active") {
        await tx
          .update(contactEmails)
          .set({ status: "active" })
          .where(eq(contactEmails.id, existing.id));
        changed = true;
      }
      if (!existing.isLogin) {
        // Clear any other login email first: at most one per contact (FR-015, enforced by a
        // partial unique index — without this the update below would violate it).
        await tx
          .update(contactEmails)
          .set({ isLogin: false })
          .where(and(eq(contactEmails.contactId, contactId), eq(contactEmails.isLogin, true)));
        await tx
          .update(contactEmails)
          .set({ isLogin: true })
          .where(eq(contactEmails.id, existing.id));
        changed = true;
      }
    }

    if (changed) {
      writeAudit({
        kind: "auth.bootstrap.designated",
        actor: "operator",
        details: { contactId, email, role: opts.role ?? null },
      });
    }

    return { contactId, displayName: contact.displayName, email, changed };
  });
}

// CLI entrypoint: pnpm run auth:bootstrap -- --email a@b.org [--contact-id <uuid>] [--role administrator]
if (import.meta.url === `file://${process.argv[1]}`) {
  loadEnv();
  const argv = process.argv.slice(2);
  const arg = (name: string): string | undefined => {
    const i = argv.indexOf(`--${name}`);
    return i === -1 ? undefined : argv[i + 1];
  };

  const email = arg("email");
  if (!email) {
    console.error(
      "usage: pnpm run auth:bootstrap -- --email <address> [--contact-id <uuid>] [--role administrator]",
    );
    process.exit(1);
  }

  const role = arg("role");
  if (role && role !== "administrator" && role !== "door_attendant") {
    console.error(`--role must be "administrator" or "door_attendant" (got "${role}")`);
    process.exit(1);
  }

  bootstrapOfficer({
    email,
    ...(arg("contact-id") ? { contactId: arg("contact-id")! } : {}),
    ...(role ? { role: role as VolunteerRole } : {}),
  })
    .then((r) => {
      console.log(
        r.changed
          ? `designated ${r.displayName} <${r.email}> as a volunteer; login email set`
          : `${r.displayName} <${r.email}> was already designated (no change)`,
      );
      process.exit(0);
    })
    .catch((err: unknown) => {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
