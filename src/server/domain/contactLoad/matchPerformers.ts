import { isNull } from "drizzle-orm";
import type { DbOrTx } from "@/server/db/client";
import { contacts, performers } from "@/server/db/schema";
import { normalizeName } from "@/server/domain/contacts/normalize";
import type { PerformerResolution } from "./loadPlan";

// Feature 044 (US4, FR-012) — propose performer↔contact links after the roster rebuild.
//
// A performer row carries no email, so the only shared handle with the loaded roster is the name: we
// match `normalizeName(performer.displayName)` to `contacts.dedup_normalized`. Exactly one match →
// auto-link; zero or several → surfaced for a human (never auto-applied on a common name).
export async function matchPerformers(db: DbOrTx): Promise<PerformerResolution> {
  const contactRows = await db
    .select({ id: contacts.id, dedup: contacts.dedupNormalized })
    .from(contacts);
  const byDedup = new Map<string, string[]>();
  for (const c of contactRows) {
    const list = byDedup.get(c.dedup) ?? [];
    list.push(c.id);
    byDedup.set(c.dedup, list);
  }

  const unlinked = await db
    .select({ id: performers.id, displayName: performers.displayName })
    .from(performers)
    .where(isNull(performers.contactId));

  const res: PerformerResolution = { auto: [], ambiguous: [], unmatched: [] };
  for (const p of unlinked) {
    const candidates = byDedup.get(normalizeName(p.displayName)) ?? [];
    if (candidates.length === 1) {
      res.auto.push({ performerId: p.id, contactId: candidates[0]! });
    } else if (candidates.length > 1) {
      res.ambiguous.push({
        performerId: p.id,
        displayName: p.displayName,
        candidateContactIds: candidates,
      });
    } else {
      res.unmatched.push({ performerId: p.id, displayName: p.displayName });
    }
  }
  return res;
}
