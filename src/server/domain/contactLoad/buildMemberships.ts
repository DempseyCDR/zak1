import { normalizeName } from "@/server/domain/contacts/normalize";
import type { PayerInput, PlannedContact, PlannedMembership, PlannedPayer } from "./loadPlan";

// Feature 044 (US3, FR-009/FR-020) — turn the Payer sheet + the roster's payer links into planned payers
// and memberships.
//
// A membership exists for each planned contact that references a payer with a usable expiry (a family
// payer therefore yields one membership per covered member, sharing expiry + level). A payer record is
// created only when at least one membership references it. The payer→contact link is the member whose
// dedup key equals the Payer Name's dedup key (FR-020); left null on no/multiple match — and because the
// roster is keyed by dedup key, "multiple" cannot occur.

export function buildMemberships(
  contacts: PlannedContact[],
  payerInputs: PayerInput[],
): { payers: PlannedPayer[]; memberships: PlannedMembership[]; skippedNoExpiry: number } {
  const payerByKey = new Map<string, PayerInput>();
  for (const p of payerInputs) payerByKey.set(p.key, p);

  const contactByDedup = new Map<string, PlannedContact>();
  for (const c of contacts) contactByDedup.set(c.dedupKey, c);

  const memberships: PlannedMembership[] = [];
  const usedPayerKeys = new Set<string>();
  let skippedNoExpiry = 0;

  for (const c of contacts) {
    if (!c.payerKey) continue;
    const payer = payerByKey.get(c.payerKey);
    if (!payer) continue;
    if (!payer.expires) {
      skippedNoExpiry++;
      continue;
    }
    memberships.push({
      contactDedupKey: c.dedupKey,
      payerKey: payer.key,
      expiry: payer.expires,
      level: payer.level,
    });
    usedPayerKeys.add(payer.key);
  }

  const payers: PlannedPayer[] = [];
  for (const key of usedPayerKeys) {
    const p = payerByKey.get(key)!;
    const linkKey = normalizeName(p.payerName);
    const contactDedupKey = contactByDedup.has(linkKey) ? linkKey : null;
    payers.push({ key, name: p.payerName, contactDedupKey });
  }

  return { payers, memberships, skippedNoExpiry };
}
