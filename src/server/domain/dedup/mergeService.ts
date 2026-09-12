import { and, eq, inArray, sql } from "drizzle-orm";
import type { Db, DbOrTx } from "@/server/db/client";
import {
  contactEmails,
  contacts,
  heldMerges,
  membershipAccounts,
  mergeAudit,
  roleGrants,
  staffIdentities,
  type HeldMergeReason,
} from "@/server/db/schema";
import { UNCONDITIONAL_MOVES } from "./contactReferences";
import { manifestBuilder, rowKey } from "./mergeManifest";
import { CAPABILITIES } from "@/server/auth/capabilities";
import { EXCLUSIVE_ROLES } from "@/server/domain/access/grantService";
import type { Role } from "@/server/db/schema";
import { errors } from "@/server/lib/apiError";
import { writeAudit, recordAudit } from "@/server/lib/audit";
import { recomputeContactStatus } from "@/server/domain/membership/membershipService";

/** The capability that may answer a hold of each kind (FR-012/FR-013). */
export type HeldMergeReasonAuthority = "role.assign" | "dedup.write";

export type LoginCandidate = { emailId: string; email: string; contactDisplayName: string };
export type GrantCandidate = {
  grantId: string;
  role: string;
  scope: string | null;
  /** Which side holds it — the exclusivity trigger can come from the survivor's side alone. */
  heldBy: "survivor" | "merged";
  /** Why this grant is contested: it confers role-assigning authority, or it breaks office exclusivity. */
  conflict: "role_assign" | "exclusive";
};

export type AccountCandidate = {
  accountId: string;
  level: string;
  expiryDate: string | null;
  payerDisplayName: string;
};

/**
 * Feature 069 (FR-011/FR-013). A merge has three possible endings, not two.
 *
 * `held` is the one that did not exist before: the merge is impossible to complete without an answer
 * nobody has given, so **nothing is written** and the question is recorded as its own piece of work. The
 * two cases are structurally identical — one login per contact, one account per payer — and both used to
 * surface as a raw Postgres unique-violation, which told Mel nothing and left her no way forward.
 *
 * (Refusals — same contact, already merged — stay thrown `ApiError`s, which is how every other route in
 * the app reports a bad request and what the contract's status table describes.)
 */
export type MergeOutcome =
  | { outcome: "completed"; canonicalId: string; moved: Record<string, number> }
  | {
      outcome: "held";
      reason: "two_logins";
      heldMergeId: string;
      candidates: LoginCandidate[];
    }
  | {
      outcome: "held";
      reason: "two_accounts";
      heldMergeId: string;
      candidates: AccountCandidate[];
    }
  | {
      outcome: "held";
      reason: "role_conflict";
      heldMergeId: string;
      candidates: GrantCandidate[];
    };

export type MergeResolution = {
  /** Feature 072 (FR-009): which of the merged contact's grants move. Empty means none — valid. */
  keepGrantIds?: string[];
  /**
   * Feature 072 (FR-012a): the Google account binding that survives. Required alongside
   * `survivingLoginEmailId` — the address alone is a label and settles nothing about access.
   */
  survivingIdentityId?: string;
  /** Chosen by a `role.assign` holder: which sign-in identity survives (FR-012). */
  survivingLoginEmailId?: string;
  /** Chosen by a `dedup.write` holder: which membership account survives. */
  survivingAccountId?: string;
};

const loginsOf = (db: DbOrTx, contactId: string) =>
  db
    .select({
      emailId: contactEmails.id,
      email: contactEmails.email,
      contactDisplayName: contacts.displayName,
    })
    .from(contactEmails)
    .innerJoin(contacts, eq(contacts.id, contactEmails.contactId))
    .where(and(eq(contactEmails.contactId, contactId), eq(contactEmails.isLogin, true)));

const identitiesOf = (db: DbOrTx, contactId: string) =>
  db
    .select({ id: staffIdentities.id })
    .from(staffIdentities)
    .where(eq(staffIdentities.contactId, contactId));

const accountsOf = (db: DbOrTx, contactId: string) =>
  db
    .select({
      accountId: membershipAccounts.id,
      level: membershipAccounts.level,
      expiryDate: membershipAccounts.expiryDate,
      payerDisplayName: contacts.displayName,
    })
    .from(membershipAccounts)
    .innerJoin(contacts, eq(contacts.id, membershipAccounts.payerContactId))
    .where(eq(membershipAccounts.payerContactId, contactId));

/**
 * Feature 072: can BOTH contacts sign in?
 *
 * A sign-in is an account binding plus the address that labels it, and either can collide —
 * `staff_identities` is unique per contact, the login address unique per contact. Exported because the
 * auto-close must ask exactly this question too: when the two disagreed, clearing one login address
 * closed the hold while the identities still collided, so the next attempt raised it again. A hold that
 * closes without the obstacle being gone is worse than one that stays.
 */
export async function bothCanSignIn(
  db: DbOrTx,
  canonicalId: string,
  mergedId: string,
): Promise<boolean> {
  const [aLogins, bLogins, aIds, bIds] = await Promise.all([
    loginsOf(db, canonicalId),
    loginsOf(db, mergedId),
    identitiesOf(db, canonicalId),
    identitiesOf(db, mergedId),
  ]);
  return (aLogins.length > 0 && bLogins.length > 0) || (aIds.length > 0 && bIds.length > 0);
}

/**
 * Feature 072 (FR-006, FR-007): would this merge compound privilege?
 *
 * Two triggers, both computed from the UNION of the pair's grants because the second can arise wholly
 * from the survivor's side (survivor President + merged Treasurer), where the record being merged
 * carries no role-assigning authority at all.
 *
 * The escalation test is "would GAIN", not "the merged record holds": merging a President into an
 * existing Super-user escalates nothing, since Super-user already supersets it, and holding there would
 * be pointless friction.
 */
export async function findRoleConflicts(
  db: DbOrTx,
  canonicalId: string,
  mergedId: string,
  keepGrantIds?: string[],
): Promise<GrantCandidate[]> {
  const rows = await db
    .select({
      id: roleGrants.id,
      contactId: roleGrants.contactId,
      role: roleGrants.role,
      seriesId: roleGrants.seriesId,
      groupId: roleGrants.groupId,
    })
    .from(roleGrants)
    .where(sql`${roleGrants.contactId} IN (${canonicalId}, ${mergedId})`);

  const assigns = (role: string) => "role.assign" in (CAPABILITIES[role as Role] ?? {});
  const survivorRoles = rows.filter((r) => r.contactId === canonicalId).map((r) => r.role);
  // Only grants actually being moved can cause a conflict. When a resolution names a subset, the ones
  // left behind are not moving and therefore compound nothing.
  const movingRows = rows.filter(
    (r) => r.contactId === mergedId && (!keepGrantIds || keepGrantIds.includes(r.id)),
  );

  const out: GrantCandidate[] = [];
  const survivorAssigns = survivorRoles.some(assigns);
  const exclusiveAfter = new Set(
    [...survivorRoles, ...movingRows.map((r) => r.role)].filter((r) =>
      EXCLUSIVE_ROLES.includes(r as Role),
    ),
  );

  for (const r of movingRows) {
    // Escalation: the survivor would gain role-assigning authority it does not already hold.
    if (assigns(r.role) && !survivorAssigns) {
      out.push({
        grantId: r.id,
        role: r.role,
        scope: r.seriesId ?? r.groupId ?? null,
        heldBy: "merged",
        conflict: "role_assign",
      });
      continue;
    }
    // Exclusivity: the union would leave one person holding two of the three exclusive offices.
    if (EXCLUSIVE_ROLES.includes(r.role as Role) && exclusiveAfter.size > 1) {
      out.push({
        grantId: r.id,
        role: r.role,
        scope: r.seriesId ?? r.groupId ?? null,
        heldBy: "merged",
        conflict: "exclusive",
      });
    }
  }
  return out;
}

/**
 * Record the hold, or return the one already standing for this pair. Kept OUTSIDE the merge transaction
 * on purpose: a hold must survive precisely because the merge did not happen.
 */
async function hold(
  db: Db,
  canonicalId: string,
  mergedId: string,
  reason: HeldMergeReason,
  actor: string,
): Promise<string> {
  const existing = await db.query.heldMerges.findFirst({
    where: and(
      eq(heldMerges.canonicalId, canonicalId),
      eq(heldMerges.mergedId, mergedId),
      sql`${heldMerges.resolvedAt} IS NULL`,
    ),
  });
  if (existing) return existing.id;

  const [row] = await db
    .insert(heldMerges)
    .values({ canonicalId, mergedId, reason, attemptedBy: actor })
    .returning({ id: heldMerges.id });
  await recordAudit(db, {
    kind: "dedup.merge_held",
    actorContactId: actor,
    details: { canonicalId, mergedId, reason },
  });
  return row!.id;
}

/**
 * Admin-confirmed, transactional merge (no automatic merges). Re-links all related records from the
 * merged contact to the canonical one, soft-retires the merged contact via merged_into_id, recomputes
 * the canonical status, and writes an append-only merge audit row.
 *
 * Feature 069: both collisions are detected BEFORE anything is written, so a held merge leaves the data
 * exactly as it found it — there is no partial merge to unpick and nothing to explain to Mel afterwards.
 */
export async function mergeContacts(
  db: Db,
  canonicalId: string,
  mergedId: string,
  actor: string,
  resolution: MergeResolution = {},
): Promise<MergeOutcome> {
  if (canonicalId === mergedId) throw errors.sameContact();

  const canonical = await db.query.contacts.findFirst({ where: eq(contacts.id, canonicalId) });
  const merged = await db.query.contacts.findFirst({ where: eq(contacts.id, mergedId) });
  if (!canonical || !merged) throw errors.contactNotFound();
  if (canonical.mergedIntoId !== null || merged.mergedIntoId !== null) throw errors.alreadyMerged();

  const [canonicalLogins, mergedLogins] = await Promise.all([
    loginsOf(db, canonicalId),
    loginsOf(db, mergedId),
  ]);
  // FR-011/FR-012 — the same check the auto-close uses, so the two can never drift apart.
  const signInCollision = await bothCanSignIn(db, canonicalId, mergedId);
  if (signInCollision && !resolution.survivingIdentityId && !resolution.survivingLoginEmailId) {
    return {
      outcome: "held",
      reason: "two_logins",
      heldMergeId: await hold(db, canonicalId, mergedId, "two_logins", actor),
      candidates: [...canonicalLogins, ...mergedLogins],
    };
  }

  const [canonicalAccounts, mergedAccounts] = await Promise.all([
    accountsOf(db, canonicalId),
    accountsOf(db, mergedId),
  ]);
  if (canonicalAccounts.length > 0 && mergedAccounts.length > 0 && !resolution.survivingAccountId) {
    return {
      outcome: "held",
      reason: "two_accounts",
      heldMergeId: await hold(db, canonicalId, mergedId, "two_accounts", actor),
      candidates: [...canonicalAccounts, ...mergedAccounts],
    };
  }

  // Feature 072 (FR-006, FR-007, FR-016): detected BEFORE the transaction opens, like the two above, so
  // a hold writes nothing but its own row.
  const roleConflicts = await findRoleConflicts(db, canonicalId, mergedId, resolution.keepGrantIds);
  if (roleConflicts.length > 0) {
    return {
      outcome: "held",
      reason: "role_conflict",
      heldMergeId: await hold(db, canonicalId, mergedId, "role_conflict", actor),
      candidates: roleConflicts,
    };
  }

  return db.transaction(async (tx) => {
    // Feature 074 (FR-001 to FR-005): the merge records what it does as it does it. Accumulated here and
    // written with the merge audit row below — one insert, one transaction, so a merge cannot commit
    // without its manifest and therefore cannot become an un-reversible merge nobody can identify as
    // one. Names inside the manifest are always the DATABASE's (snake_case); see `mergeManifest.ts`.
    const manifest = manifestBuilder();

    // Feature 072 (FR-012, FR-012a): apply the sign-in choice as ONE thing. The identity that was not
    // chosen is DELETED, not moved — `staff_identities` is unique per contact, and sign-in auto-enrols,
    // so the person simply signs in with the surviving Google account. That is FR-006 (one account per
    // person) working as designed, not a lockout.
    if (resolution.survivingIdentityId) {
      // Feature 074: snapshot in full before deleting. `google_sub` is the only durable handle on a
      // Google account — an id recorded without it could never be re-created.
      const discarded = [
        ...(await tx.execute<Record<string, unknown>>(sql`
          DELETE FROM staff_identities
           WHERE contact_id IN (${canonicalId}, ${mergedId})
             AND id <> ${resolution.survivingIdentityId}
          RETURNING *
        `)),
      ];
      for (const row of discarded) {
        manifest.destroy({
          table: "staff_identities",
          key: rowKey(row, ["id"]),
          row,
          accessChanging: true,
        });
      }
      // The chosen binding may itself be the merged contact's, in which case it MOVES. Recording the
      // move conditionally matters: claiming a move that did not happen would make the undo take the
      // survivor's own binding away from it.
      const relinked = [
        ...(await tx.execute<Record<string, unknown>>(sql`
          UPDATE staff_identities SET contact_id = ${canonicalId}
           WHERE id = ${resolution.survivingIdentityId} AND contact_id = ${mergedId}
          RETURNING id
        `)),
      ];
      for (const row of relinked) {
        manifest.move({
          table: "staff_identities",
          column: "contact_id",
          key: rowKey(row, ["id"]),
          fromContactId: mergedId,
          accessChanging: true,
        });
      }
    } else {
      // Uncontested: only one side can sign in, so it simply moves — preserving `last_sign_in_at`, and
      // sparing the person a needless re-enrolment round trip (FR-011).
      const relinked = [
        ...(await tx.execute<Record<string, unknown>>(sql`
          UPDATE staff_identities SET contact_id = ${canonicalId}
           WHERE contact_id = ${mergedId}
          RETURNING id
        `)),
      ];
      for (const row of relinked) {
        manifest.move({
          table: "staff_identities",
          column: "contact_id",
          key: rowKey(row, ["id"]),
          fromContactId: mergedId,
          accessChanging: true,
        });
      }
    }

    // The label follows the binding.
    if (resolution.survivingLoginEmailId) {
      // Feature 074 (FR-003): capture the prior value before overwriting it. This is the one operation
      // that changes a row the merge leaves in place, so there is no deleted row to snapshot — only the
      // flag itself, which is what actually labels who may sign in.
      const demoted = [
        ...(await tx.execute<Record<string, unknown>>(sql`
          UPDATE contact_emails SET is_login = false
           WHERE contact_id IN (${canonicalId}, ${mergedId})
             AND is_login = true
             AND id <> ${resolution.survivingLoginEmailId}
          RETURNING id
        `)),
      ];
      for (const row of demoted) {
        manifest.overwrite({
          table: "contact_emails",
          key: rowKey(row, ["id"]),
          column: "is_login",
          previousValue: true,
          accessChanging: true,
        });
      }
    }

    // Apply the account choice the same way: fold the losing household in, then drop the empty account.
    // Nobody attached to the account that was NOT kept loses their membership because of this merge.
    // ⚠️ DESTRUCTIVE: the account not chosen is DELETED, taking its level, expiry and last-payment date
    // with it. Only the attachments survive, moved onto the surviving account.
    if (resolution.survivingAccountId) {
      const losing = [...canonicalAccounts, ...mergedAccounts]
        .map((a) => a.accountId)
        .filter((id) => id !== resolution.survivingAccountId);
      for (const accountId of losing) {
        // Feature 074 (FR-004): RETURNING yields only the rows actually inserted, because
        // ON CONFLICT DO NOTHING silently skips anyone already on the surviving account. Those are the
        // rows an undo must take away again — without recording them the survivor would keep a
        // household it never had.
        const created = [
          ...(await tx.execute<Record<string, unknown>>(sql`
            INSERT INTO membership_members (account_id, contact_id)
            SELECT ${resolution.survivingAccountId}, mm.contact_id
              FROM membership_members mm WHERE mm.account_id = ${accountId}
            ON CONFLICT DO NOTHING
            RETURNING account_id, contact_id
          `)),
        ];
        for (const row of created) {
          manifest.create({
            table: "membership_members",
            key: rowKey(row, ["account_id", "contact_id"]),
          });
        }

        // ⚠️ Feature 074 (FR-002), and the reason this block is not symmetric with the one above:
        // `membership_members.account_id` is ON DELETE CASCADE, so deleting the account below destroys
        // EVERY household row on it — including the ones the INSERT just skipped, which were therefore
        // never copied anywhere. No statement in this merge names those rows; they simply vanish. They
        // must be snapshotted here, before the delete, or an undo restores the account with an empty
        // household and loses each member's original `attached_at`.
        const cascaded = [
          ...(await tx.execute<Record<string, unknown>>(sql`
            SELECT * FROM membership_members WHERE account_id = ${accountId}
          `)),
        ];
        for (const row of cascaded) {
          manifest.destroy({
            table: "membership_members",
            key: rowKey(row, ["account_id", "contact_id"]),
            row,
          });
        }

        // The account itself, in full: level, expiry and last-payment date all die with it.
        const [discardedAccount] = [
          ...(await tx.execute<Record<string, unknown>>(sql`
            DELETE FROM membership_accounts WHERE id = ${accountId} RETURNING *
          `)),
        ];
        if (discardedAccount) {
          manifest.destroy({
            table: "membership_accounts",
            key: rowKey(discardedAccount, ["id"]),
            row: discardedAccount,
          });
        }
      }
    }

    // ---------------------------------------------------------------- collisions, then the move
    //
    // Feature 072 (FR-001, FR-008). Two references carry a unique constraint the survivor may already
    // satisfy, so the losing row is dropped rather than the merge failing on a raw constraint error —
    // the failure mode feature 069 exists to eliminate. Both are genuinely the same fact recorded twice:
    // the duplicate was added to one household under two spellings, or attended one event under two
    // names. Feature 074 (FR-002): the dropped row is now snapshotted in full before it goes, so the
    // drop is recorded rather than silent and an undo can put the duplicate back.
    const droppedMembers = [
      ...(await tx.execute<Record<string, unknown>>(sql`
        DELETE FROM membership_members m
         WHERE m.contact_id = ${mergedId}
           AND EXISTS (SELECT 1 FROM membership_members s
                        WHERE s.account_id = m.account_id AND s.contact_id = ${canonicalId})
        RETURNING *
      `)),
    ];
    for (const row of droppedMembers) {
      manifest.destroy({
        table: "membership_members",
        key: rowKey(row, ["account_id", "contact_id"]),
        row,
      });
    }
    const droppedAttendance = [
      ...(await tx.execute<Record<string, unknown>>(sql`
        DELETE FROM attendance a
         WHERE a.contact_id = ${mergedId}
           AND EXISTS (SELECT 1 FROM attendance s
                        WHERE s.event_id = a.event_id AND s.contact_id = ${canonicalId})
        RETURNING *
      `)),
    ];
    for (const row of droppedAttendance) {
      manifest.destroy({ table: "attendance", key: rowKey(row, ["id"]), row });
    }

    // Feature 072 (FR-008): grants move only once the conflict check above has passed. A resolution may
    // name a subset; anything not named stays on the retired contact, where nothing reads it. The
    // duplicate is dropped rather than colliding — the same person plausibly holds the same role at the
    // same scope on both records.
    const movedGrants = await tx
      .update(roleGrants)
      .set({ contactId: canonicalId })
      .where(
        and(
          eq(roleGrants.contactId, mergedId),
          // `inArray` with an empty list compiles to `false`, which is exactly right: naming no grants
          // means none move.
          ...(resolution.keepGrantIds ? [inArray(roleGrants.id, resolution.keepGrantIds)] : []),
          sql`NOT EXISTS (
            SELECT 1 FROM role_grants s
             WHERE s.contact_id = ${canonicalId} AND s.role = ${roleGrants.role}
               AND s.series_id IS NOT DISTINCT FROM ${roleGrants.seriesId}
               AND s.group_id IS NOT DISTINCT FROM ${roleGrants.groupId})`,
        ),
      )
      .returning({ id: roleGrants.id });
    for (const row of movedGrants) {
      manifest.move({
        table: "role_grants",
        column: "contact_id",
        key: { id: row.id },
        fromContactId: mergedId,
      });
    }

    // The relink itself is driven by the CLASSIFICATION, not by tables named here (FR-002). That is the
    // whole point: feature 068 retired the membership tables and this service went on relinking the old
    // pair for two releases, because the only statement of what to move was the code doing the moving.
    // A newly classified reference is now carried without touching this file.
    //
    // Identifiers come from `contactReferences.ts` — our own constant, never user input — so building
    // the statement with `sql.identifier` is safe.
    const moved: Record<string, number> = { role_grants: movedGrants.length };
    for (const ref of UNCONDITIONAL_MOVES) {
      // Feature 074 (FR-001): the statement returns each moved row's KEY rather than a bare `1`, so the
      // move is recorded reversibly. The key is the one the classification declares, which is why
      // `membership_members` — composite key, no `id`, and its `contact_id` rewritten by this very
      // statement — is carried here without a special case. RETURNING yields post-update values, so the
      // key is the row's identity AS IT NOW STANDS, which is what an undo will look it up by.
      const pkColumns = ref.pk.map((c) => c.name);
      const rows = [
        ...(await tx.execute<Record<string, unknown>>(sql`
          UPDATE ${sql.identifier(ref.table)}
             SET ${sql.identifier(ref.column)} = ${canonicalId}
           WHERE ${sql.identifier(ref.column)} = ${mergedId}
          RETURNING ${sql.join(
            pkColumns.map((c) => sql.identifier(c)),
            sql`, `,
          )}
        `)),
      ];
      for (const row of rows) {
        manifest.move({
          table: ref.table,
          column: ref.column,
          key: rowKey(row, pkColumns),
          fromContactId: mergedId,
        });
      }
      moved[ref.table] = rows.length;
    }

    // Soft-retire the merged contact: the row itself survives intact — names, phone, pronouns, source
    // and timestamps are all untouched — so clearing `merged_into_id` brings the contact back.
    //
    // Feature 074: that clearing is now one step of a real undo rather than a tantalising half-measure.
    // Everything above has been recorded in `manifest`, so the relinking is no longer one-way — see
    // `undoMergeService.ts`. Merges recorded BEFORE 074 remain permanently un-reversible, because their
    // `reversal_manifest` is NULL and nothing can reconstruct it.
    await tx
      .update(contacts)
      .set({ mergedIntoId: canonicalId, updatedAt: new Date() })
      .where(eq(contacts.id, mergedId));

    // Canonical may have gained membership coverage → recompute its cached status.
    await recomputeContactStatus(tx, canonicalId, "membership_change", actor);

    // Feature 074 (FR-005): the manifest rides the merge's OWN audit insert, inside this transaction.
    // Not a second write — a merge that committed while its manifest failed would be un-reversible and
    // indistinguishable from a pre-074 merge, which is the one outcome this feature cannot allow.
    await tx.insert(mergeAudit).values({
      canonicalId,
      mergedId,
      actor,
      relinkedCounts: moved,
      reversalManifest: manifest.build(),
    });
    writeAudit({ kind: "contact.merge", actor, details: { canonicalId, mergedId, moved } });

    return { outcome: "completed" as const, canonicalId, moved };
  });
}
