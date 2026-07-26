import type { EmailPurpose, EmailStatus } from "@/server/db/schema";

/**
 * Feature 020 US2 (FR-011): choose the email address to put behind a performer's mailto link. Among the
 * contact's **active** emails, prefer one whose purposes include `booking`, else `personal`, else
 * `public_profile`; the `other` purpose never qualifies. Returns null when nothing matches — the caller
 * then shows no mailto link. Pure.
 */
export type MailtoEmail = { email: string; purposes: EmailPurpose[]; status: EmailStatus };

const PREFERENCE: readonly EmailPurpose[] = ["booking", "personal", "public_profile"];

export function mailtoEmailFor(emails: MailtoEmail[]): string | null {
  const active = emails.filter((e) => e.status === "active");
  for (const purpose of PREFERENCE) {
    const hit = active.find((e) => e.purposes.includes(purpose));
    if (hit) return hit.email;
  }
  return null;
}
