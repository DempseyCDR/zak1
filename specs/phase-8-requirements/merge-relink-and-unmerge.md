# Phase 8 — Merge relinking & undo (requirements draft)

**Status:** pre-SpecKit requirements draft (developed conversationally; will seed `/speckit-specify`).
Descends from **M-R21**'s open item in [mel-contact-maintenance.md](mel-contact-maintenance.md) §7 and the
no-unmerge gap recorded in [mel-maintenance-remaining.md](mel-maintenance-remaining.md).

Requirement IDs are `MRG-Rn`. Anything marked _(open)_ is not yet decided.

**Split:** §1–§5 are **feature 072** (relinking, shipped 2026-09-11). §6 is **feature 074** (undo,
shipped 2026-09-12) — it was numbered 073 while this document was drafted, but that number was consumed
by the project rename, so the undo feature is 074. §6's requirements were settled in the requirements
session of 2026-09-11 and are no longer open.

---

## 1. The problem

A merge moves **three** tables — `contact_emails`, `membership_accounts`, `membership_members` — while
**ten** reference a contact. Everything else is silently left on the retired shell. Feature 069 fixed the
membership half (068 had left the merge relinking tables it had retired); this covers the rest.

Measured on `zak1_dev` across 36 merges: **6 performers** stranded on merged contacts, **1** on an
archived contact, **2 attendance** rows, and 21 `status_change_audit` rows (those correctly stay).

Three silent failures follow from the stranded performers alone — no error is raised in any of them:

1. **The Booker's email link disappears.** `getPerformerMailtoEmail` dereferences `contact_id` with no
   active-contact predicate; the merge moved the emails to the survivor, so the shell has none and the
   booking modal renders nothing.
2. **They vanish from `performer.csv`.** The export resolves through `resolvedRecipients`, which _does_
   gate merged/archived, so the performer silently drops out of the mailing list.
3. **The organizer report skews.** The FR-022a open-band guard asks "is this contact a booked performer?"
   through `performers.contact_id`. If the performer points at the shell but the door checks the person in
   as the survivor, the guard misses — they are counted as a booked performer _and_ an unpaid open-band
   comp, so paying dancers is double-subtracted.

## 2. Actor & authority

- **MRG-R1** — Relinking is part of the merge and needs no capability beyond the existing
  **`dedup.write`**.
- **MRG-R2** — Where a merge would move **role-assigning authority**, `dedup.write` is **not** sufficient;
  the merge is held for a **`role.assign`** holder (see MRG-R8). No new capability is introduced.

## 3. What a merge moves

- **MRG-R3 — The rule is "move everything except audit."** Stated as a rule rather than an allowlist so a
  table added later is moved by default: forgetting must fail in the safe direction. An explicit list is
  exactly what went stale after feature 068.
- **MRG-R4 — Moved** (the survivor inherits): every substantive reference to the contact —
  `attendance`, `gate_sales`, `membership_captures`, `performers`, `officers`, `venues.landlord_contact_id`,
  plus the three already moved.
- **MRG-R5 — Left in place**: anything recording **who did something**, because rewriting it would falsify
  the historical record — `status_change_audit`, `merge_audit`, `audit_events.actor_contact_id`,
  `dedup_rejections.rejected_by`, `held_merges.attempted_by`, `contacts.volunteer_approved_by`,
  `role_grants.granted_by`. Also the pair columns on `dedup_rejections` / `held_merges`: a merged contact
  is excluded from the pair query anyway, so a stale row can never match.
- **MRG-R6 — Archived contacts behave exactly as merged ones** throughout. Both already mean "not an
  active record" everywhere else, and the seventh stranded performer is archived, not merged.

## 4. Sign-in identity

- **MRG-R7 — A colliding sign-in is ONE decision, not two.** Two sign-in-capable records collide twice
  over: `staff_identities` is UNIQUE on `contact_id`, and the login address is unique per contact. Feature
  069 already holds this merge (`two_logins`) — but **its resolution moves only the `is_login` label and
  never touches the identity**, so the officer answering it changes nothing about who can actually sign
  in. Access follows the Google account binding, not the label. Correct the hold so it resolves the
  **surviving sign-in**: the Google account and the address it is reached at, chosen together as one
  answer. It must not be possible to settle the address while leaving the binding untouched.

  Where only **one** record carries a sign-in, it **moves** with no hold (preserving `last_sign_in_at`) —
  there is nothing to choose. The Google account that does not survive is refused on use, which is
  **FR-006 (one Google account per person)** working as designed; making that re-pointable is already
  tracked as backlog **B38**.

  Note the label and the binding are _designed_ to be able to disagree (feature 015, R9: "the `sub`
  binding wins and the mismatch is logged"), because a Google account can be renamed without telling us.
  That is why the address alone can never be the thing a merge resolves.

## 5. Role grants

- **MRG-R8 — Grants move, except where privilege compounds.** The merge is **held** with a new reason
  **`role_conflict`** when either:
  - the survivor would **gain** a role carrying `role.assign` that it does not already hold (Vice-
    President, President, Super-user). That capability lets its holder grant themselves anything else, so
    `dedup.write` alone must never confer it; **or**
  - the union of both grant sets would hold two different **mutually exclusive** roles
    (President / Vice-President / Treasurer, FR-005a — separation of authority from money). This is a
    **cross-row** invariant enforced in the service, never as a row constraint, so a merge that relinks in
    SQL bypasses it entirely. **The trigger can come from the survivor's side** (survivor President +
    merged Treasurer), so the test is on the **union**, not on the merged contact alone.
- **MRG-R9 — Otherwise grants move, and an identical duplicate collapses.** The unique key is
  `(contact_id, role, series_id, group_id)` with `NULLS NOT DISTINCT`, and the same person plausibly holds
  the same role at the same scope on both records; the duplicate is dropped rather than colliding, the
  same way feature 069 already handles a duplicate household attachment.
- **MRG-R10 — Resolving a `role_conflict`** requires `role.assign` and names the **subset of the merged
  contact's grants to move**. One mechanism covers both triggers: decline the role-assigning grant, or
  choose which exclusive role survives. Moving none is a valid answer.

## 6. Undo _(settled — feature 074, shipped)_

- **MRG-R11 — RESOLVED by feature 074.** The diagnosis below was correct and is what 074 fixed:
  `merge_audit` recorded **counts, not identifiers** (`{"contact_emails": 2}`), so it could say a merge
  happened but not what moved, and the re-pointed rows could not be told apart from the survivor's own.
  A merge now writes a `reversal_manifest` alongside those counts, and an undo replays it.

  Two limits, both deliberate: merges recorded **before** 074 have no manifest and stay permanently
  un-reversible (there is no backfill — the information was never written down), and a merge is
  reversible only while its survivor is still live, so chains unwind most-recent-first. See
  `specs/074-undo-merge/`.
- **MRG-R12 _(open)_ — Two paths are outright destructive**, both from feature 069: a colliding
  `membership_members` row is deleted, and so is the account not chosen when a `two_accounts` hold is
  resolved (taking its level, expiry and last-payment date). Reversibility requires these to be marked
  superseded rather than deleted.
- **MRG-R13 _(open)_ — Undecided:** the retention window (permanent vs. a fixed period vs. audit-only with
  manual reconstruction); what makes a merge un-undoable (the survivor merged again, a moved row edited
  since); and whether a refusal must **say what changed** or may simply refuse.

**Sequencing:** undo comes second by necessity — a corrected relink set is a precondition for recording
what to reverse, and 072 must not record the ids of a relink set already known to be wrong.

## 7. Adjacent fixes in scope

Both are the same subsystem, small, and surfaced while tracing the above:

- **MRG-R14 — A retired contact must not yield a session, by EITHER route.** Sign-in resolves two ways: a
  **known** Google account (matched on its immutable id) and a **first-time enrolment** (matched by
  address). Neither checks whether the contact is merged or archived — only whether it is a volunteer. So
  a retired contact can still mint a session that feature 071 then refuses on every subsequent request:
  sign-in appears to succeed and the app is dead. Both branches need the check, and the refusal must
  happen at sign-in.

- **MRG-R15 — Auto-linking must not offer a retired contact.** `matchPerformers` (the `contacts:load`
  auto-linker) selects **all** contacts with no active filter, so merged shells are eligible link targets.
  Worse, a merge leaves the shell's dedup key identical to the survivor's, which makes the name
  **ambiguous** — so the correct link is suppressed too.

## 8. Explicitly out of scope

- **The 19 performers with no contact at all.** Verified as a designed, supported state rather than merge
  damage: **13 of the 14** real ones have no matching contact to link to (touring musicians, guest
  callers), `matchPerformers` exists precisely to work that queue, and `createPerformer` refuses to create
  an unlinked performer. Whether a performer should _require_ a contact is a **Booker workflow** policy
  question with mailing-list consequences — see [booker-events.md](booker-events.md).
- **5 seed-created performers** (`Sample Caller`, `Sample Sound Tech`, `Danny Drums`, `Fiona Fiddle`,
  `Petra Piano`) — dev residue, a one-line delete, needs no feature.
- **The held-merge resolution chooser UI**, still unbuilt for all reasons including the new one; feature
  069's quickstart manual pass; and M-R16 telemetry on mobile. Tracked in
  [mel-maintenance-remaining.md](mel-maintenance-remaining.md).

## 9. Historical repair

- **MRG-R16 — The rows already stranded are not repaired by fixing the merge.** The seven performers (and
  two attendance rows) predate the fix and need a one-off backfill re-pointing them at
  `merged_into_id`, shipped with the feature.
