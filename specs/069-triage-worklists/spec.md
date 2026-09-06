# Feature Specification: Triage Mode — Worklists

**Feature Branch**: `069-triage-worklists`

**Created**: 2026-09-05

**Status**: Draft

**Input**: User description: "triage mode worklists, M-R18 through M-R22"

## Overview

Mel works through two queues: contacts **needing review** (incomplete records, mostly created at the door)
and **possible duplicates**. Today both are lists she can open, but neither lets her finish anything. A
duplicate pair shows two names, a phone and the active emails — not enough to tell "the same person
entered twice" from "two people who happen to be named alike" — and there is no way to say **these are not
duplicates**, so a pair she has already judged comes back every time she opens the queue.

This feature makes the queues resolvable. Rows carry enough to decide; safe decisions are made in place;
consequential ones open a proper comparison. A rejected pair stays gone until the thing that proposed it
actually changes. And the merge stops failing at the one case it cannot currently survive — two people who
both sign in.

Pairs are proposed on **name similarity alone** (a trigram score over the structured first+last key, at or
above 0.4). Nothing else contributes: not email, not phone, not household. That is worth stating plainly,
because it means the queue shows near-identical *full* names — a father and son both called Robert Jones —
rather than family coincidences, which never reach it.

## Clarifications

### Session 2026-09-05

- Q: How is a "not duplicates" rejection stored, given four separate code paths write the structured name? → A: **Store the two names as judged.** The rejection records both `dedup_normalized` values and suppresses the pair only while both still match, so it lapses automatically through any path — no clearing hook, and no way for a missed path to suppress a pair forever.
- Q: How does a held merge live in the needs-review queue, when that queue is a per-contact flag? → A: **As its own item** — the pair, the reason, who attempted it and when — rendered in the needs-review queue alongside flagged contacts. The queue shows two kinds of task, each explaining itself.
- Q: What makes a row "safely resolvable in place"? → A: **Derived from the row** — safe exactly when the row already displays every fact the decision depends on. Ties the in-place action to the row's content, so the two cannot drift apart.
- Q: Where does a rejection become visible and reversible? → A: **In the duplicates queue** — rejected pairs are revealable from the queue itself and undoable in place, so the remedy sits where the absence would be noticed rather than on a screen nobody visits until they already suspect a mistake.
- Q: How many resolutions does a pair offer, once `/dedup` is retired? → A: **All three on the pair** — merge (same person), link as shared (one household), reject (unrelated) — with the existing link-as-shared safeguards moving across. One place, one decision.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Decide from the row, and make a rejection stick (Priority: P1)

Mel opens the duplicates queue and sees a pair. The row shows her enough to judge: each side's name, when
the record was created and last touched, how they are reached, their membership standing, and whether they
already belong to the same household. She decides these are two different people and marks them **not
duplicates**. The pair leaves the queue and does not return.

It returns only if the thing that proposed it changes — a first or last name edit on either side. A
nickname or display-name change does not bring it back, because the proposal never depended on that.

**Why this priority**: Without it the queue cannot be worked down. Every pass re-presents judgements Mel
has already made, so the queue never shrinks and stops being worth opening. Delivering just this makes it
finishable.

**Independent Test**: Reject a pair; confirm it is absent on reload. Change a first or last name on either
contact; confirm it is offered again if it still meets the criteria. Change a display-name override only;
confirm it stays gone.

**Acceptance Scenarios**:

1. **Given** a suggested pair, **When** Mel marks it not duplicates, **Then** it disappears from the queue
   and is still absent after reload.
2. **Given** a rejected pair, **When** either contact's first or last name changes, **Then** the pair is
   offered again if it still meets the similarity criteria.
3. **Given** a rejected pair, **When** a display-name override changes but the underlying first/last names
   do not, **Then** the pair stays out of the queue.
4. **Given** a duplicates row, **When** Mel reads it, **Then** it shows for each contact enough to decide
   without opening anything: identity, how they are reached, standing, record age, and whether the two
   already share a household.
5. **Given** a rejected pair, **When** anyone asks who dismissed it and when, **Then** that is recorded.

---

### User Story 2 - Finish the safe rows in place (Priority: P2)

Most rows in either queue are unambiguous. A needs-review contact whose record is now complete just needs
clearing. A pair Mel can see is two different people just needs rejecting. She does those **from the row**,
without opening anything.

The rows that are not safe say so. A merge where the two records disagree, a pair where both people sign
in, a record too sparse to judge — these offer **open to resolve** instead of a one-click action, because
finishing them needs a decision the row cannot show. Opening the record is available from every row
regardless.

**Why this priority**: This is what makes a queue of dozens tractable. It is P2 because it needs the richer
rows from US1 to know which rows are safe.

**Independent Test**: A complete needs-review row clears in one action; a sparse one offers open-to-resolve
instead. A clearly-distinct pair rejects in one action; a conflicting one offers open-to-resolve. Every row
opens the record.

**Acceptance Scenarios**:

1. **Given** a needs-review row whose record is complete, **When** Mel acts on it, **Then** she can clear
   the review in place, and the contact leaves the queue.
2. **Given** a needs-review row whose record is too sparse to judge, **When** Mel reads it, **Then** it
   offers open-to-resolve rather than an in-place clear.
3. **Given** a duplicate pair whose records conflict on the fields that matter, **When** Mel reads it,
   **Then** it offers open-to-resolve rather than an in-place action.
4. **Given** any row in either queue, **When** Mel chooses to open it, **Then** the record (or the
   comparison, for a pair) opens.

---

### User Story 3 - Compare two records properly before merging (Priority: P3)

When a pair really is one person, Mel opens a **comparison** of the two records side by side and confirms
which survives. The comparison shows the emails held by each — **every** email, not only the reachable
ones — and states plainly that the survivor inherits all of them, because that is what merging does and it
is not obvious from a list of names.

This is the only place a merge happens. The separate duplicates page is retired: the queue in the contacts
view does everything it did, with more information and the ability to reject.

**Why this priority**: Merging is destructive and rare compared with rejecting. It needs care rather than
speed, which is why it earns a screen rather than a row action.

**Independent Test**: Open a pair; both records are shown side by side with all their emails; confirm a
survivor; the merge completes and the other contact's emails, memberships and payer records move across.

**Acceptance Scenarios**:

1. **Given** a pair Mel judges to be one person, **When** she opens it, **Then** both records are shown for
   comparison with every email each holds, whatever its status.
2. **Given** the comparison, **When** Mel reads it, **Then** it states that the surviving contact inherits
   all of the other's emails.
3. **Given** the comparison, **When** Mel confirms a survivor, **Then** the merge completes and everything
   attached to the other contact moves to the survivor.
4. **Given** the old separate duplicates page, **When** this feature ships, **Then** it is gone and nothing
   it offered has been lost.

---

### User Story 4 - Two people who both sign in (Priority: P4)

Occasionally both halves of a pair are volunteers who sign in. Only one sign-in identity can survive a
merge, so the merge cannot quietly complete — and today it does not fail gracefully: it hits a database
constraint and reports a raw error.

Whoever holds the authority to assign roles resolves it **in place**: they choose which sign-in survives
and the merge completes. Anyone else cannot, and must not be stuck: the merge is **held** and appears in
the needs-review queue as a task for an officer, framed as resolving that person's staff identity — which
is what it is, since it touches their roles and access, not merely an email.

**Why this priority**: Rare, but it is the one case that currently fails hard rather than gracefully. P4
because the other stories deliver value without it.

**Independent Test**: Attempt to merge two contacts who both sign in. As a role-assigner, choose the
surviving sign-in and see the merge complete. As anyone else, see the merge held and a needs-review task
appear naming the problem.

**Acceptance Scenarios**:

1. **Given** two contacts who both sign in, **When** a role-assigner merges them, **Then** they choose
   which sign-in survives and the merge completes.
2. **Given** the same pair, **When** someone without that authority attempts the merge, **Then** the merge
   does not complete, no data is changed, and the reason is explained in terms of staff identity.
3. **Given** a merge held for that reason, **When** the needs-review queue is opened, **Then** a task is
   there describing the identity to be resolved and naming both contacts.
4. **Given** two contacts where only one signs in, **When** they are merged, **Then** the merge completes
   without asking anything extra.

---

### Edge Cases

- **A pair rejected, then one contact renamed back.** The rejection is judged against the names as they
  were when it was made; restoring the old name restores the rejection's relevance and the pair stays out.
- **A pair where one side is later merged or archived.** It no longer qualifies at all, rejection or not.
- **A household that looks like a duplicate.** Two people already sharing an address (a linked household)
  are already excluded from the queue and remain so. A pair not yet linked is the case "link as shared"
  exists for — and linking it removes it from the queue thereafter, without a rejection being needed.
- **Three resolutions, one of them destructive.** Merge retires a contact; the other two do not. The pair
  must not present them as equivalent choices of equal weight.
- **A rejection made in error.** Because it hides something, the mistake is invisible by construction — the
  pair simply stops appearing. Revealing rejections from the queue itself is what makes such a mistake
  findable at all, so it is not an optional convenience.
- **A needs-review task that nobody can action.** A held merge names an officer's job; it must not sit in
  the queue looking like ordinary clean-up, and Mel — who cannot resolve it — must be able to tell at a
  glance that it is not hers to finish.
- **A held merge whose contacts change underneath it.** If one side is merged away, archived, or stops
  holding a sign-in, the held merge no longer describes a real problem and must not linger as a task.
- **Both queues showing the same person.** A contact can be in needs-review and in a duplicate pair at
  once; resolving one does not silently resolve the other.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A duplicates row MUST show, for each contact, enough to decide without opening either record:
  identity, how the contact is reached, membership standing, when the record was created and last changed,
  and whether the two already belong to the same household.
- **FR-001a**: A **needs-review** row MUST likewise show what its decision depends on — who the contact is,
  how they can be reached, and when the record was created and last changed — so that "complete enough to
  clear" is judged from the row rather than from an unstated rule. FR-005's derivation applies to both
  queues, and each row type needs its own displayed facts for that to mean anything.
- **FR-002**: Users MUST be able to mark a suggested pair **not duplicates**, after which it MUST NOT be
  offered again while the criteria that proposed it are unchanged.
- **FR-003**: A rejection MUST lapse when either contact's **structured first or last name** changes, since
  that is the only thing pair proposal depends on. A change to a display-name override MUST NOT lapse it.
- **FR-003a**: The rejection MUST be judged by **recording the two names as they were when it was made**
  and suppressing the pair only while both still match — not by a flag that some later edit must remember
  to clear. The lapse is then a property of the data, correct through every path that changes a name,
  including paths added later.
- **FR-004**: Every **rejection** — the record left by marking a pair *not duplicates* — MUST record who
  made it and when. Throughout: Mel's action is **"not duplicates"**, and the thing it records is a
  **rejection**; the two words are not alternatives for each other.
- **FR-004a**: Rejected pairs MUST be **revealable from the duplicates queue itself** — where their absence
  would be noticed — and each MUST be undoable in place, returning the pair to the queue if it still meets
  the criteria. A rejection MUST NOT be discoverable only by knowing to look somewhere else.
- **FR-005**: A row is **safely resolvable in place** exactly when the row itself already displays every
  fact the decision depends on. Such a row MUST offer a single action that resolves it — a complete
  needs-review record can be cleared; a plainly distinct pair can be rejected.
- **FR-006**: A row whose decision depends on anything **not shown** MUST instead offer to open for
  resolution. This follows from FR-005 rather than from a separate list, so the two cannot drift apart: if
  a fact matters to the decision, either the row shows it (and the action is safe) or the row sends Mel to
  where it can be seen. In practice this covers at least a pair whose records conflict on the fields that
  matter, a pair where both contacts sign in, and a record too sparse to judge.
- **FR-007**: Opening the underlying record MUST be available from every row in either queue.
- **FR-008**: A pair MUST open a **comparison of the two records**, not an inline field-by-field merge.
- **FR-009**: The comparison MUST show **every** email held by each contact regardless of status, and MUST
  state that the surviving contact inherits all of them.
- **FR-010**: Confirming a merge MUST move everything attached to the other contact to the survivor and
  leave the merged contact retired rather than deleted, as today.
- **FR-011**: Where **both** contacts hold a sign-in identity, the merge MUST NOT complete silently and
  MUST NOT fail with a raw error.
- **FR-012**: A user holding the authority to assign roles MUST be able to choose which sign-in survives
  and complete the merge in one step.
- **FR-013**: Without that authority, the merge MUST be **held** with no data changed, and MUST explain
  that it is a staff-identity decision rather than an email one.
- **FR-014**: A held merge MUST be recorded as **its own item** — both contacts, the reason it was held,
  who attempted it and when — and MUST appear in the **needs-review** queue alongside flagged contacts. The
  queue therefore presents two kinds of task, and each MUST say what it is: a held merge names both
  contacts and the identity decision required, and is never mistakable for ordinary record clean-up.
- **FR-014a**: Clearing a contact's review flag MUST NOT clear a held merge, and resolving a held merge
  MUST NOT clear either contact's review flag. They are separate tasks that may both be outstanding.
- **FR-015**: The separate duplicates page MUST be retired, with everything it offered available from the
  queue.
- **FR-015a**: A pair MUST offer **all three** resolutions to the one question it poses: **merge** (the
  same person), **link as shared** (different people, one household), and **reject** (unrelated). Mel MUST
  NOT have to choose a surface before she has decided what is true.
- **FR-015b**: The link-as-shared safeguards MUST move with the action: it MUST name the address the
  contact would adopt, and MUST require explicit confirmation before retiring an address that contact
  already owns. A name-similar pair is not evidence of a household.
- **FR-016**: Resolving a row in one queue MUST NOT silently resolve a related row in the other; a contact
  may legitimately appear in both.

### Key Entities *(include if feature involves data)*

- **Duplicate suggestion**: A proposed pair, produced from name similarity alone. Not stored — recomputed
  each time the queue is opened — so anything that suppresses a pair must be stored separately.
- **Rejection ("not duplicates")**: A recorded human judgement about one pair — the two contacts, who
  decided, when, and **the two structured names as they stood at that moment**. It suppresses the pair only
  while both names still match (FR-003a), so it needs no maintenance and cannot silently outlive its
  reason.
- **Held merge**: A merge that could not complete because both contacts sign in — recorded as its own item
  carrying both contacts, the reason, and who attempted it when. It changes no contact data, and surfaces
  in the needs-review queue as an officer's task. Distinct from a contact's review flag: either can be
  outstanding without the other (FR-014a).
- **Contact**: Unchanged, but its structured name now also governs whether a rejection still applies.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The duplicates queue **shrinks as it is worked**: a pair Mel has judged never reappears
  unless a name changed, so repeat passes present only new or genuinely changed pairs.
- **SC-002**: Mel can resolve a straightforward row — clear a complete record, or reject a distinct pair —
  in **one action from the row**, without opening anything.
- **SC-003**: For any pair in the queue, Mel can tell whether the two are the same person **from the row
  alone** in the common case, and is offered a comparison **exactly** when the row is not enough — never a
  one-click action on a decision the row cannot support, and never a detour for one it can.
- **SC-004**: Merging two contacts who both sign in **never** produces a raw failure: it either completes
  with an explicit choice of surviving sign-in, or is held with nothing changed and a task raised.
- **SC-005**: After this feature there is **one** place to work duplicates, offering all three resolutions
  a pair can have, and nothing the retired page did has been lost.
- **SC-006**: Every rejection is attributable and reversible **from the queue it was made in** — no pair
  disappears without a record of who decided, and Mel can find and undo one without knowing in advance
  that it exists.

## Assumptions

- **Rejection is judged against the names, not a timestamp** (confirmed in clarification). Storing the
  names judged against also rules out lapsing on an unrelated edit — a corrected phone number does not
  resurrect a settled judgement.
- **Authority is unchanged.** Working the queues and merging use the duplicate-resolution authority Mel
  already holds; choosing a surviving sign-in uses the existing role-assignment authority held by the
  Vice-President, President and Super-user.
- **"Safely resolvable" is derived, not enumerated** (confirmed in clarification): it is a function of what
  the row displays, so adding a fact to the row can make a decision safe, and removing one cannot leave a
  stale rule behind. There is no separate configurable list to maintain.
- **The similarity criteria themselves are unchanged.** This feature does not alter what proposes a pair —
  no new email or phone matching — only what Mel can see and do about it.
- **Contacts already sharing a household remain excluded** from the queue, as they are today.
- **A held merge is a needs-review task, not a new third queue** (confirmed in clarification) — stored as
  its own item so it can explain itself, but surfaced in the queue Mel already works.

## Dependencies

- **The duplicate suggestion criteria** — name similarity over the structured first+last key — which
  determine what enters the queue and therefore what a rejection must be judged against.
- **The existing merge engine**, which already moves emails, memberships and payer records to the survivor
  and retires the merged contact.
- **The needs-review queue**, which gains held-merge tasks alongside ordinary record clean-up.
- **The contacts view's two worklists**, which this feature makes resolvable.
- **The shared-household model**, whose linked pairs are already excluded from the queue and whose
  "record as a household" resolution moves off the retired page.

## Out of Scope

- **Changing what proposes a pair.** No email, phone or address matching is added; the similarity rule and
  its threshold are untouched.
- **Bulk actions.** Rows are resolved one at a time.
- **Automatic merging.** Every merge remains an explicit human confirmation.
- **Reworking the needs-review clearing rule** beyond adding held-merge tasks to that queue.
- **Any change to how sign-in itself works.** Choosing a surviving identity is a merge-time decision; the
  authentication path is untouched.
