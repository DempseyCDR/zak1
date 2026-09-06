# Phase 0 Research: Triage Mode — Worklists

No NEEDS CLARIFICATION markers remain; the five clarification answers settled rejection storage, held-merge
shape, the safe/open split, where a rejection is reversible, and how many resolutions a pair offers. This
research is about landing those against the existing code — and about two defects found while reading it.

## R1 — Suppressing a rejected pair without a clearing hook

**Decision**: `dedup_rejections` stores the pair **and the two `dedup_normalized` values as they stood when
rejected**. The suggestion query suppresses a pair only while both current values still equal the stored
ones.

**Rationale**: Pairs are proposed on `dedup_normalized` alone, so that is the only thing a rejection can
sensibly be judged against. Four separate places write that column — `contactService` (create and patch),
`attendanceService` (the door creating a contact at check-in), and the contact load — so a plain flag would
need four clearing hooks, and a missed one would suppress a pair **forever, silently**: no error, nothing
to notice, just a duplicate that never comes back. Storing the judged names makes the lapse a property of
the data, correct through paths added later. It is the same lesson as feature 068's stale status: derive
rather than remember to invalidate.

Suppression is a `NOT EXISTS` against the pair, evaluated in the same query that proposes pairs — one round
trip, no per-pair lookup.

**Alternatives considered**:

- *A flag cleared on name change* — rejected: four hooks, silent failure mode.
- *A flag plus a comparison against `updated_at`* — rejected: lapses on **any** edit, so correcting a phone
  number would resurrect a judgement Mel had already made.

## R2 — `mergeService` does not move membership accounts (defect from 068)

**Decision**: The merge must transfer the merged contact's **account ownership and attachments** to the
survivor, and stop relinking `memberships`/`payers`.

**Rationale**: Verified by reading the code: `mergeService` still updates `memberships` and `payers` — the
tables feature 068 retired and nothing now reads — and does nothing with `membership_accounts` or
`membership_members`. Merging an account owner today would leave the household's account owned by a contact
that is retired via `merged_into_id`, so it disappears from every read while the survivor gains nothing.

Measured on the dev database: **0 orphaned accounts** so far (no merge has happened since 068) and **1
attachment on an already-merged contact** ("Bobbi", inherited from the migration attaching every
`memberships.contact_id` without filtering merged rows). So the damage is latent rather than done — the
next merge of an account owner causes it.

This belongs in 069 rather than a separate fix: it is merge correctness, and 069 is the feature that
reworks the merge.

**Alternatives considered**: a standalone bug-fix branch — rejected as splitting one change to
`mergeService` across two features, with 069 immediately re-touching it.

## R3 — Two collisions, one shape

**Decision**: Model the merge as a **three-way outcome** — completed, held, or refused — rather than a
function that throws when a constraint bites. Two conditions produce "held":

1. **Both contacts hold a sign-in email** (M-R21) — `contact_emails_one_login_per_contact` allows one.
2. **Both contacts own a membership account** — `membership_accounts_payer` is UNIQUE on the payer.

**Rationale**: They are structurally identical: a survivor may hold only one of something both parties
have, so a person must choose. Today the first throws a raw database error and the second would too.
Treating them as one shape means one held-merge mechanism, one queue task type, and one test pattern rather
than two.

They differ in **who** may resolve them: the sign-in choice is staff-identity governance and needs
`role.assign` (Vice-President, President, Super-user), while the account choice is a membership decision.
Both are held for the same reason — the merge cannot be completed silently — so both surface the same way.

**Alternatives considered**: resolving the account collision automatically by keeping the survivor's account
and discarding the other — rejected: it silently destroys a household's membership term.

## R4 — What a duplicates row must carry

**Decision**: Extend the suggestion projection with record age (created/updated), and the **household
facts** — whether the two already share an address (feature 067) or an account (068) — alongside the name,
phone, emails and membership standing it already carries.

**Rationale**: FR-005 makes "safely resolvable" a function of what the row shows, so the row's content is
what decides how much Mel can finish in place. The household facts are the strongest evidence a pair is
*not* one person, and they did not exist when the current row was designed (feature 033). Record age
separates "entered twice last week" from "two people the club has known for years", which is the common
tell for a genuine duplicate.

Worth stating because it constrains what to add: pairs are proposed on **name similarity alone**, so the
row cannot show "why this was proposed" beyond the score — and never shows a shared email or phone as the
reason, because those never propose a pair.

## R5 — Retiring `/dedup`

**Decision**: Delete the page. Keep `/api/dedup/suggestions` and `/api/dedup/merge` — the contacts-view
queue already calls both — and add rejection and held-merge endpoints beside them.

**Rationale**: The queue in the contacts view calls the same two endpoints the page does, so retirement is a
UI deletion, not an API one. The page's one unique contribution is feature 067's guarded **link as shared**,
which moves to the pair along with its safeguards (name the address being adopted; confirm before retiring
one the contact already owns). FR-015b keeps those explicit, because a name-similar pair is not evidence of
a household — the same trap 067 recorded.

**Alternatives considered**: keeping the page as a power-user view — rejected: two places to work duplicates
is exactly the confusion this feature removes, and the queue is strictly richer.

## R6 — Held merges alongside flagged contacts

**Decision**: `held_merges` is its own table, surfaced **in** the needs-review queue rather than as a third
queue, with the two task kinds rendered distinctly.

**Rationale**: `contacts.needs_review` is a per-contact boolean; a held merge is about a **pair** and has a
reason. Flattening it into flags loses both, and clearing either flag would lose the pairing entirely.
Keeping it separate also gives the independence FR-014a requires — a contact's review flag and a held merge
can each be outstanding without the other.

A held merge must not outlive its cause: if either contact is merged away, archived, or stops holding the
thing that collided, it no longer describes a real problem and is resolved automatically rather than
lingering as a task nobody can action.
