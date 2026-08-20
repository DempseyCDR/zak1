import { deriveContactNames, normalizeName } from "@/server/domain/contacts/normalize";
import { normalizePhone } from "@/server/domain/contacts/phone";
import { mapConsentTopics } from "./mapConsent";
import type { IcontactRow, MemberRow, PlannedContact, PlannedEmail } from "./loadPlan";

// Feature 044 (US1) — fold the iContact export and the Member sheet into one roster.
//
// Join key is email; same-person collapse across differing emails is the normalized-name dedup key
// (FR-002/FR-004). The Member sheet wins for identity (name/pronouns/phone, FR-003); iContact owns email
// consent. A person may appear only in one file, in both, or on several iContact rows (one contact, many
// emails).

function localPart(email: string): string {
  return email.split("@")[0] ?? email;
}

// A single record standing for two people, e.g. "Hilary & Ed". Matches "&" or a spaced " and " so it
// never trips on a normal name that merely contains the letters (Amanda, Andrew).
function isCombined(name: string): boolean {
  return /&| and /i.test(name);
}

/** Attach/refresh an email on a planned contact (dedup by address; iContact consent wins). */
function upsertEmail(pc: PlannedContact, next: PlannedEmail): void {
  const existing = pc.emails.find((e) => e.email === next.email);
  if (!existing) {
    pc.emails.push(next);
    return;
  }
  // A later iContact row is authoritative for consent + provider dates; a member-only email keeps its
  // contact_tracing-only default unless an iContact row supplies more.
  if (next.consentTopics.length >= existing.consentTopics.length) {
    existing.consentTopics = next.consentTopics;
  }
  existing.providerSetDate ??= next.providerSetDate;
  existing.providerLastOpen ??= next.providerLastOpen;
  existing.providerLastClick ??= next.providerLastClick;
}

export function buildRoster(icontact: IcontactRow[], members: MemberRow[]): PlannedContact[] {
  const planned = new Map<string, PlannedContact>();
  const memberByEmail = new Map<string, string>(); // emailLower -> dedupKey
  const fromMember = new Set<string>(); // dedupKeys whose identity came from the Member sheet

  const ensure = (dedupKey: string, seed: () => PlannedContact): PlannedContact => {
    let pc = planned.get(dedupKey);
    if (!pc) {
      pc = seed();
      planned.set(dedupKey, pc);
    }
    return pc;
  };

  // --- Members first: they own identity. ---
  for (const m of members) {
    let firstName = m.firstName;
    let needsReview = false;
    if (!firstName) {
      firstName = m.email ? localPart(m.email) : "(unknown)";
      needsReview = true;
    }
    if (isCombined(firstName)) needsReview = true;
    const structured = `${firstName} ${m.lastName ?? ""}`.trim();
    const override =
      m.buttonName && normalizeName(m.buttonName) !== normalizeName(structured)
        ? m.buttonName
        : null;
    const names = deriveContactNames({
      firstName,
      lastName: m.lastName,
      displayNameOverride: override,
    });
    const key = names.dedupNormalized;

    const pc = ensure(key, () => ({
      dedupKey: key,
      firstName,
      lastName: m.lastName,
      displayNameOverride: override,
      pronouns: m.pronouns,
      phone: m.phone ? normalizePhone(m.phone) : null,
      isVolunteer: false,
      needsReview: false,
      emails: [],
      payerKey: null,
    }));
    if (fromMember.has(key)) pc.needsReview = true; // two distinct members collided on the same name key
    fromMember.add(key);

    // Member wins identity.
    pc.firstName = firstName;
    pc.lastName = m.lastName;
    pc.displayNameOverride = override;
    pc.pronouns ??= m.pronouns;
    if (m.phone) pc.phone = normalizePhone(m.phone);
    pc.isVolunteer = pc.isVolunteer || m.volunteer;
    pc.payerKey ??= m.payerKey;
    if (needsReview) pc.needsReview = true;

    if (m.email) {
      memberByEmail.set(m.email, key);
      upsertEmail(pc, {
        email: m.email,
        consentTopics: mapConsentTopics(null),
        providerSetDate: null,
        providerLastOpen: null,
        providerLastClick: null,
      });
    }
  }

  // --- iContact rows: contribute emails + consent, and identity only where no member exists. ---
  for (const r of icontact) {
    let needsReview = false;
    let targetKey = memberByEmail.get(r.email) ?? null;

    let firstName = r.firstName;
    if (!firstName) {
      firstName = localPart(r.email);
      needsReview = true;
    }
    if (isCombined(firstName)) needsReview = true;

    if (!targetKey) {
      const names = deriveContactNames({ firstName, lastName: r.lastName });
      targetKey = names.dedupNormalized;
    }

    const email: PlannedEmail = {
      email: r.email,
      consentTopics: mapConsentTopics(r.flags),
      providerSetDate: r.providerSetDate,
      providerLastOpen: r.providerLastOpen,
      providerLastClick: r.providerLastClick,
    };

    const existing = planned.get(targetKey);
    if (existing) {
      upsertEmail(existing, email);
      if (needsReview) existing.needsReview = true;
      // iContact never overrides a member's identity; for an iContact-only contact the first row's
      // identity already stands.
    } else {
      planned.set(targetKey, {
        dedupKey: targetKey,
        firstName,
        lastName: r.lastName,
        displayNameOverride: null,
        pronouns: null,
        phone: r.phone ? normalizePhone(r.phone) : null,
        isVolunteer: false,
        needsReview,
        emails: [email],
        payerKey: null,
      });
    }
  }

  return [...planned.values()];
}
