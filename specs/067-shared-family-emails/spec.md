# Feature Specification: Shared / Family Emails (ownership + reference)

**Feature Branch**: `067-shared-family-emails`

**Created**: 2026-09-03

**Status**: Draft

**Input**: User description: "shared family emails, i.e., M-R23, M-R24, M-R25, M-R26, M-R27"

## Overview

A household often gives the club **one email address for contact tracing** that covers everyone in
the family. Today the system treats any address that is already active on another contact purely as a
*duplicate signal* — active emails must be unique across contacts — so two family members cannot both
be reached at the same address without merging them into one record (which is wrong: they are different
people) or hitting a raw uniqueness error. This feature models legitimate sharing with an **ownership +
reference** design: one contact **owns** the address, and other household members **reference** it as
their message recipient for contact tracing, without owning an email row or any consent of their own.

## Clarifications

### Session 2026-09-03

- Q: Which capability gates creating, changing, and ending a shared-email reference? → A: `contact.mailing.write` (global for Mel per M-R2). Merge remains under `dedup.write`.
- Q: Which exports resolve a reference to the owner's address? → A: **All** mailing-list exports, not just contact tracing — every list export resolves references and dedupes by resolved address.
- Q: When a referencing contact qualifies for a contact-derived list (member, performer) but the owner does not, does the household address appear? → A: Yes — the referrer's own qualification pulls the resolved address onto the list; the owner's `do_not_contact` still suppresses it absolutely.
- Q: What shape is an exported row for a deduped household? → A: One row per resolved address, named for the **owner**. The provider file format is unchanged (no extra column); the household roster is visible **in the app**, not in the export file.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Record two people who share one household email, without merging them (Priority: P1)

Mel is cleaning up contacts and finds that Bridget's address is `shared@jones.com` — the same address
already active on David Jones. They are married, not the same person. Instead of being forced to merge
them or leaving a broken duplicate, Mel resolves the collision as **"different people — shared email"**:
David remains the **owner** of `shared@jones.com`, and Bridget is recorded as **referencing** David's
address for contact tracing. Bridget's record now has no email row of her own — she rides David's
address.

**Why this priority**: This is the whole point of the feature and the minimum viable slice. Without it,
a legitimate family share is unrepresentable — the only outcomes are an incorrect merge or an
unresolved duplicate. Delivering just this lets Mel record shared households correctly.

**Independent Test**: Take two distinct contacts where one already owns an address; resolve the
same-address situation as "link as shared"; confirm both contacts persist as separate records, the
owner keeps the owned email row, and the referencing contact points to it with no email row of its own —
and that no uniqueness error is raised.

**Acceptance Scenarios**:

1. **Given** David owns active email `shared@jones.com` and Bridget is a separate contact with no email,
   **When** Mel links Bridget as sharing David's address, **Then** both contacts remain distinct, David
   still owns the address, and Bridget references it (a message-recipient pointer to David's owned email)
   with no email row and no independent consent of her own.
2. **Given** a same-address collision surfaces while editing a contact's email (the feature-066 "already
   active on X" prompt), **When** Mel chooses "different people — link as shared" instead of "review as
   duplicate / merge", **Then** the editing contact is recorded as a reference to the existing owner's
   email, no second owned row for that address is created, and the row she was editing is retired (set
   inactive) so the contact is left riding the owner's address.
3. **Given** Mel is resolving a suggested-duplicate pair that is actually a family share, **When** Mel
   chooses "link as shared" rather than "merge", **Then** the pair is not merged — one becomes owner (or
   stays owner) and the other becomes a reference — and the pair is no longer offered as a suggested
   duplicate (FR-018), rather than re-surfacing on every later pass through the queue.

---

### User Story 2 - Reach a shared household exactly once (Priority: P2)

The reason the reference exists is delivery. When the club sends to any mailing list, Bridget must be
reachable — but the household must be contacted **once**, not twice, even though two contacts resolve to
`shared@jones.com`. **Every** mailing-list export (not only contact tracing) resolves each referencing
contact to the owner's address and **dedupes by resolved address**, so the household appears a single
time as one row carrying the **owner's** name. Who else rides that address is visible **in the app** (on
the records themselves), keeping the provider file exactly the shape it is today.

**Why this priority**: A reference that cannot actually deliver is worthless. This story turns the model
into the operational payoff Mel needs, and proves the reference resolves correctly end to end. It is P2
because it depends on the ownership link from US1 existing first.

**Independent Test**: Create an owner with a shared address and one referencing contact; run each
mailing-list export; confirm the address appears exactly once under the owner's name, that the export
columns are unchanged, and that a referencing contact with no resolvable address does not appear.

**Acceptance Scenarios**:

1. **Given** David owns `shared@jones.com` and Bridget references it, **When** any mailing-list export for
   which that household qualifies is produced, **Then** the address appears exactly once, in a single row
   carrying David's (the owner's) name, using the existing export columns.
2. **Given** Bridget references David's address, **When** Mel opens Bridget's record, **Then** the record
   clearly shows Bridget is reached via David's shared address (read-only, naming the owner) and offers no
   editable email row or independent consent controls for Bridget.
3. **Given** a contact references no address and owns none, **When** any mailing-list export is produced,
   **Then** that contact contributes no row (there is nothing to reach).

---

### User Story 3 - Lifecycle: a sharer gets their own address, or the shared address goes away (Priority: P3)

Sharing is not permanent. Two lifecycle transitions must be handled cleanly. (a) When Bridget later gives
the club her **own** address, Mel captures it as an owned email row on Bridget, and her reference to
David's address ends — she is now reached at her own address. (b) When David's shared address is **removed
or deactivated**, every contact that referenced it must not be silently orphaned: each referencing
contact's pointer is cleared and the contact is flagged **needs review** so someone re-captures a working
address for them.

**Why this priority**: These transitions prevent stale or dangling delivery over time. They are P3 because
the core value (US1 + US2) stands without them for an initial release, but they are required before the
model is trustworthy in ongoing maintenance.

**Independent Test**: (a) Add an owned email to a referencing contact and confirm its reference is
cleared. (b) Deactivate or remove an owner's shared email and confirm every referrer's pointer is cleared
and each referrer is flagged needs-review.

**Acceptance Scenarios**:

1. **Given** Bridget references David's address, **When** Mel adds an owned email address to Bridget,
   **Then** Bridget's reference to David's address is cleared and she is reached at her own address.
2. **Given** Bridget references David's `shared@jones.com`, **When** David's shared email is removed
   (hard-deleted) or set inactive, **Then** Bridget's pointer is cleared and Bridget is flagged
   needs-review to re-capture an address.
3. **Given** David's owned email is re-pointed to a surviving contact through a merge, **When** the merge
   completes, **Then** any references to that email continue to resolve (the reference follows the email,
   which keeps its identity) and no referrer is orphaned by the merge alone.

---

### Edge Cases

- **Same person, not a share.** A same-address collision that is genuinely one person must still resolve
  as a **merge**, not a share. "Link as shared" and "merge" are two distinct, deliberate resolutions of
  the same collision; the system never auto-picks one.
- **Whole household.** More than one contact may reference the same owned email (e.g., David owns it;
  Bridget and a child both reference it). All references to that one address are valid simultaneously.
- **Referencing a non-active address.** A reference may only be created against an address that is
  currently reachable (an active owned email). An attempt to reference an inactive/absent address is
  refused with a clear message rather than creating a dead pointer.
- **Reference cannot sign in or own login.** A referencing contact has no email row, so it can never carry
  the staff sign-in identity — only the owner can sign in with the shared address. This holds by
  construction and must not regress.
- **Sign-in resolution stays unambiguous.** Because a reference is a pointer on the contact (not an email
  row), the shared address still resolves to exactly one contact for sign-in — the owner — with no change
  to sign-in matching or the active-email uniqueness rule.
- **Referrer qualifies, owner does not.** Bridget is a paid member and David (the address owner) is not:
  the household address appears on the member list (the row carries David's name, as the address owner).
  The reverse also holds — David's own qualification never depends on Bridget.
- **Owner opted out.** If the owner's email carries `do_not_contact`, the address appears on **no** list,
  regardless of what any referring contact qualifies for.
- **Adding vs editing a colliding address.** When Mel **adds** the household address to a contact that
  has none, linking is the clean case — nothing is retired, because the contact owns nothing. When she
  **edits** an existing address to the household one (typically because that person's own address is
  dead), the edited row is retired as part of linking (FR-017).
- **Unlinking.** Mel can end a reference (Bridget no longer rides David's address); the contact reverts to
  having no reachable address (and is a candidate for needs-review / re-capture).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001 (M-R23)**: An email address MUST be **owned** by exactly one contact — the contact holding the
  email row (its address, purposes, consent, status, and any sign-in flag). Ownership is unchanged from
  today.
- **FR-002 (M-R23)**: A contact MUST be able to **reference another contact's owned email** as its
  **message recipient** for contact tracing, via a single reference from the referencing contact to the
  owner's owned email. A referencing contact holds **no email row and no independent consent** of its own.
- **FR-003 (M-R23)**: A contact MUST reference **at most one** owned email at a time (a single household
  message recipient), and MUST NOT reference an email it owns itself.
- **FR-004 (M-R26)**: A same-address collision MUST offer **two distinct resolutions** — **merge** (same
  person) or **link as shared** (different people, one household email) — and MUST NOT auto-resolve to
  either. "Link as shared" records one contact as owner and the other as a reference.
- **FR-005 (M-R26)**: The "link as shared" resolution MUST be available wherever a same-address collision
  surfaces in Mel's maintenance flow: the duplicates/merge-compare resolution, and both record-editor
  collision paths — **adding** an address and **editing** an existing one. The add path currently detects
  the collision server-side but discards it in the UI; it MUST surface the named collision so the same
  three-way choice is offered there.
- **FR-006 (M-R24)**: Adding, resolving, or removing a reference MUST NOT change the active-email
  cross-contact uniqueness rule, because a reference is a pointer on the contact, not an email row. A
  shared address still resolves to exactly one owning contact.
- **FR-007 (M-R24, M-R25)**: Staff sign-in behavior MUST be unchanged: sign-in matches an active **owned**
  email to exactly one contact; a referencing contact (no email row) is never a sign-in match, and the
  "more than one active match" invariant continues to hold.
- **FR-008 (M-R25)**: The staff sign-in / login flag MUST remain **owner-only**: only the owner of a
  shared address may sign in with it; a referencing contact can never carry a login flag (it has no email
  row to hold one).
- **FR-009 (M-R23, US2)**: A referencing contact's record MUST display, read-only, that it is reached via
  the owner's shared address and MUST name the owning contact. It MUST NOT offer the referencing contact
  its own editable email row or independent consent controls.
- **FR-010 (US2)**: **Every** export — all six mailing lists **and** the separate contact-tracing export —
  MUST resolve each referencing contact to its owner's address, **dedupe by resolved address** so a shared household is
  reached exactly once as a **single row carrying the owner's name**. The export column format is
  **unchanged** — no household-names column is added. A contact with no owned and no referenced address
  contributes nothing to any export.
- **FR-010a (US2)**: A referencing contact's **own** qualification for a contact-derived list (e.g. member,
  performer) MUST place the **resolved** (owner's) address on that list even when the owner does not
  qualify for it; the emitted row still carries the **owner's** name (per FR-010). Lists are classified by
  **qualification source**: where qualification is the **owner's consent alone** (the topic lists), a
  referencing contact holds no consent topics of her own and so cannot pull an address onto the list; where
  qualification comes from the **contact row** — `list_member`, a performer link, or attendance at an
  event — a referrer's own qualification does pull the resolved address in. Contact tracing is of the
  latter kind: attendance qualifies, and the owner's `contact_tracing` consent still gates.
- **FR-010b (US2)**: The owner's `do_not_contact` MUST suppress the address **absolutely** — no referring
  contact's qualification may place a do-not-contact address on any list.
- **FR-010c (US2)**: Because the export file no longer names the household, the **app** MUST make the
  roster visible: the owner's record MUST show which contacts reference its address, and a referencing
  contact's record MUST name its owner (FR-009). This is where "who was reached" is answered.
- **FR-011 (M-R27)**: When a referencing contact gains its **own** owned email address, its reference MUST
  be cleared automatically — it is now reached at its own address, not the shared one.
- **FR-012 (M-R27)**: When an owned email that is referenced by others is **removed or deactivated**, every
  referencing contact's pointer MUST be cleared and each such referencing contact MUST be flagged
  **needs review** so an address can be re-captured. No referring contact may be left pointing at a
  removed/inactive address.
- **FR-013 (M-R20)**: When the **owner** of a referenced email is merged into a surviving contact, the
  references MUST continue to resolve to that email (the email keeps its identity as it re-points to the
  survivor); the merge alone MUST NOT orphan any referrer.
- **FR-014**: Creating a reference MUST require the reference target to be an **active owned email**; an
  attempt to reference an inactive or non-existent address MUST be refused with a clear, non-error-code
  message rather than creating a dangling pointer.
- **FR-015**: Mel MUST be able to **end (unlink)** a reference; the contact then has no reachable address
  and is eligible for the needs-review / re-capture path.
- **FR-016 (privacy)**: The **resolved address** MUST be withheld from an actor who may not read contact
  PII, exactly as an owned address already is. The owner's **name** may still be shown, so a referrer's
  record stays comprehensible ("reached via David Jones") without disclosing the address. The resolved
  address MUST NOT be exposed through any other read path.
- **FR-017**: Linking from an **address-edit** collision MUST retire the referrer's own edited row —
  setting it inactive, the established meaning of "remove" (M-R17), preserving history and telemetry — in
  the same operation as setting the pointer. Linking MUST otherwise be refused for a contact that retains
  an active owned email, since a contact with a working address of its own is not a referrer (FR-002).
- **FR-018**: A pair already linked as shared MUST NOT be offered as a suggested duplicate. Suggestions
  pair on **name** similarity at a 0.4 trigram threshold. *Measured*: differing first names dominate the
  score, so a same-surname household like "David Jones" / "Bridgit Jones" reaches only 0.30 and never
  enters the queue. The pairs that do reach it are near-identical names — "Robert Jones" / "Rob Jones"
  at 0.64, a father and son at one address, or a couple entered inconsistently. Those are precisely the
  pairs Mel resolves as a share rather than a merge, and without suppression they return on every pass.
- **FR-019**: Name similarity MUST NOT be treated as evidence of a shared household. Households do not
  reliably share a surname (Tim Ball and Lydia Dempsey), and a shared surname does not imply a household
  (Lydia Dempsey and Richard Dempsey, who must **not** share an address). Where "link as shared" is offered
  on a name-similar pair, the action MUST name the **address the referring contact would adopt** and MUST
  require explicit confirmation before retiring any address that contact already owns. The primary
  discovery path for a share is the **address collision** (FR-005), which is name-independent; the
  duplicates queue is a secondary path only. *Measured mitigation*: at 0.36, Lydia and Richard Dempsey
  fall below the 0.4 threshold and never appear as a pair, so that specific error cannot be made from the
  queue — but the confirmation is still required, because the queue's near-identical pairs (a father and
  son) are the ones where adopting the wrong address is plausible.
- **FR-020**: A contact's record display MUST follow the same precedence as the export resolver — an
  **active owned email wins over a reference**. A contact holding both (possible while a stale pointer
  survives, e.g. before the lifecycle clearing of FR-011 is deployed) MUST be shown as reached at her own
  address, never as reached via the owner, so the record can never contradict where mail actually goes.
  The stale pointer SHOULD be offered for clearing.

### Key Entities *(include if feature involves data)*

- **Owned email**: An address record belonging to exactly one contact, carrying the address, purposes,
  consent topics, status (active / transition / inactive), and the optional staff-sign-in flag. Unchanged
  by this feature; it is the *only* place an address and its consent live.
- **Message-recipient reference**: A single, optional pointer from a **referencing contact** to a
  **contact's owned email**, meaning "reach this contact at that shared address for contact tracing." It
  carries no consent, no status, and no sign-in capability of its own. It is cleared when the referring
  contact gains its own address (FR-011) or when the referenced email is removed/deactivated (FR-012).
- **Contact**: Gains the optional message-recipient reference. A contact is either reached at an address it
  **owns**, reached via a **reference** to someone else's owned address, or reachable by neither.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A household in which two distinct people use one address can be recorded as **two separate
  contacts** sharing that address, with **zero forced merges** and **zero uniqueness errors**.
- **SC-002**: Any mailing-list send reaches a shared household **exactly once** (no household
  double-contacted, no household member's entitlement lost), across all list exports — not only contact
  tracing — with **no change to the export column format**. Anyone who needs to know who was reached can
  see the full household roster in the app in a single step.
- **SC-003**: Existing staff sign-in and active-email uniqueness behavior is **fully preserved** — 100% of
  the existing sign-in and email-uniqueness checks continue to pass after this feature ships.
- **SC-004**: When a shared address is removed, **100%** of the contacts that referenced it are flagged for
  re-capture, with **no** contact left pointing at a removed or inactive address.
- **SC-005**: Mel can resolve a same-address collision as a share in a **single action** from either the
  duplicates queue or the record editor, without leaving the maintenance flow.

## Assumptions

- **Authority.** Creating, changing, and ending a message-recipient reference is treated as a mailing /
  message-recipient concern and is gated by `contact.mailing.write` (global for Mel per M-R2). Merge stays
  under `dedup.write`. (Candidate for confirmation in clarify.)
- **Pointer-only model (Resolved in the source doc).** A referencing contact holds **no** email row and
  **no** independent list/consent subscriptions — the single nullable reference is sufficient; there is no
  "reference-type" email row.
- **Reference target must be reachable.** A reference points at an **active** owned email; inactive/removed
  targets are handled by the lifecycle rules (FR-011, FR-012), not by allowing dead pointers.
- **A contact is not both owner and referrer for delivery.** Owning an active address supersedes a
  reference; capturing an owned address ends any reference (FR-011).
- **Export semantics.** All mailing-list exports dedupe by **resolved** address and emit one row per
  address under the **owner's** name, leaving the provider file format untouched; the email provider also
  enforces dedupe regardless. (The source doc resolved dedupe-by-resolved-address for the contact-tracing
  export; clarified here to cover every list, and to keep the household roster in the app rather than in
  the file.)
- **No email/consent schema changes** beyond adding the single reference pointer; the active-email
  uniqueness rule, sign-in matching, and the login flag are unchanged **by construction** (the reference
  lives on the contact, not on an email row).
- **Surfaces.** "Link as shared" appears in Mel's area only: the duplicates/merge-compare resolution and
  the feature-066 record-editor collision path. The door-check-in shared affordance (MEG-R5, Meg's area)
  is a **separate** feature and out of scope here.
- **Multiple referrers allowed.** Several contacts may reference the same owned email (whole household).

## Dependencies

- **Feature 066 (contact email editor)** — the record-editor email rows and the "already active on X"
  same-address collision path that this feature extends with a "link as shared" resolution.
- **Dedup / merge engine** (`dedup.write`, merge-compare view) — the duplicates queue where a pair can be
  resolved as a share instead of a merge, and merge behavior that re-points emails (M-R20).
- **Feature 015 sign-in** and the **active-email uniqueness** rule — invariants this feature must preserve
  without change (M-R24, M-R25).
- **Feature 065 (archive / needs-review)** — the needs-review flag reused for the re-capture path
  (FR-012).
- **Feature 016 capabilities** — `contact.mailing.write` (global for Mel per M-R2) as the reference
  authority; `dedup.write` for merge.

## Out of Scope

- **Meg's door-check-in shared affordance (MEG-R5).** The public/door-flow way to link a shared email is a
  separate feature; this feature covers Mel's maintenance surfaces only. Noted for that feature: the door
  path today creates the contact, attempts the email insert, and **silently swallows** the uniqueness
  violation — so a household address offered at check-in is discarded entirely and the contact is left
  flagged `needs_review` with no record that an address was ever given. The door path also bypasses
  `addEmailInTx` and runs outside a transaction, so resolving the owner and writing a pointer there would
  be straightforward when MEG-R5 is specified.
- **The two-login merge governance (M-R21)** and other triage-mode worklist behaviors.
- **Any independent consent or list subscription for a referencing contact** — explicitly excluded by the
  pointer-only model.
- **Provider telemetry changes (M-R16)** and other email-row edits already delivered in feature 066.
