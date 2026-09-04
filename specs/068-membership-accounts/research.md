# Phase 0 Research: Membership Accounts

No NEEDS CLARIFICATION markers remain — the five clarification answers settled renewal semantics, the
money boundary, level ownership, status derivation, and payer deletion. This research is about **how** to
land those against the existing code without losing membership coverage.

## R1 — The account shape, and what it replaces

**Decision**: Two new tables — `membership_accounts` (payer contact, level, expiry, last payment date) and
`membership_members` (account ↔ member contact) — replacing **both** `memberships` and `payers`, with the
data moved in the same migration.

**Rationale**: The current pair stores the household three times over: a row per member, the level and
expiry copied across the group, and a `payers` indirection carrying a name that duplicates the contact's.
FR-001 makes the payer *a contact*, and FR-021 guarantees every historical payer becomes one — so the
`payers` table has nothing left to hold. Verified: `memberships.payer_id` is the **only** foreign key into
`payers`, so retiring it touches nothing else. Keeping both models would leave two sources of truth for
"who is a member", which is precisely the bug this feature exists to remove (Constitution II).

**Alternatives considered**:

- *Add attachments beside the existing `memberships`* — rejected: the level and expiry would still be
  per-member, so nothing stops them drifting apart, and the member list would still have two candidate
  definitions.
- *Rename/repurpose `memberships` in place* — rejected: the column semantics change (a row stops meaning
  "a person's membership" and starts meaning "a household's account"), and a rename hides that from anyone
  reading a migration later.
- *Per-payment term rows under a durable account* — this was option C at clarification; the user chose the
  durable account without term history.

## R2 — Idempotency after dropping the source-id indexes

**Decision**: Drop `source_gate_sale_id` / `source_notification_id` and their partial unique indexes. Keep
a plain `last_payment_date` on the account for reconciliation.

**Rationale**: A durable account cannot carry a unique key per payment — many payments, one row. Checked
what those indexes were actually protecting:

- **Door**: `putGateSales` deletes and re-inserts gate-sale rows on every save, so their ids were never
  stable enough to key on. Its real guard is the **renewal no-op** — a contact already covered to the
  target boundary is skipped — which survives unchanged as FR-004's "move forward, never twice".
- **Online**: replay protection is `paypal_notifications.provider_event_id UNIQUE`, checked in
  `processNotification` *before* anything is created. The membership-level index was a second belt on a
  guard that already holds.

So no idempotency is lost. This matters because PayPal is out of scope but must not be broken.

**Alternatives considered**: keeping the columns nullable and unindexed — rejected as dead weight recording
only the *most recent* payment's provenance, which `last_payment_date` conveys more honestly.

## R3 — Deriving status at the point of use

**Decision**: One module, `membershipStatus.ts`, exposing the coverage derivation as a joinable SQL
fragment (status, level, expiry, is-member) computed from accounts and attachments. Every read path uses
it. `contacts.membership_status` and `contacts.list_member` are **backfilled once** (FR-015a) and stop
being the source of truth.

**Rationale**: Clarification chose "derive where it matters" precisely to kill the stale-cache bug that
left 118 memberships reading `current` after 1 September. Derivation must be one implementation — a survey
found the materialised columns read in **10 files**, including the member export, the dedup suggestion
query, the contacts page, the check-in page, and the dedup page. Re-deriving independently in each is how
they would drift. Doing it in SQL keeps the export and list paths to a single round trip rather than an
N+1 per contact.

**What becomes of the stored columns.** Once every reader is re-pointed they are written but never read,
so their status must be deliberate rather than incidental. The decision: **retain them as a
write-refreshed cache, owned by the membership service**, and drop them in the same follow-up that retires
the legacy tables. Two reasons to keep them for now — `contacts.membership_status` and `list_member` sit in
`SEARCH_COLS` and in the contact-load path, so removing the columns would widen this feature into a schema
change across surfaces it otherwise does not touch; and while they exist they must not be *wrong*, which is
what FR-015a's one-off correction is for. The invariant is: **the derivation is authoritative; the columns
are a cache that is correct after the backfill and refreshed on write.** `list_member` in particular must be
maintained from **attachment** (FR-011), not from `isListMember(status)`, which encodes the superseded
"has any history" rule.

**Alternatives considered**:

- *A materialised view* — rejected: it needs refreshing, which reintroduces the scheduler this design
  deliberately avoids.
- *Dropping the stored columns outright* — attractive but touches `SEARCH_COLS` and the contact-load path
  for no behavioural gain here; **deferred to the follow-up that drops the legacy tables**, not rejected.

## R4 — Enforcing the capacity rule (FR-003a)

**Decision**: Service-level enforcement in `accountService`, on both edges — attaching a member, and
lowering a level — with the refusal naming who would be displaced.

**Rationale**: The rule is "count of members ≤ what the level allows", a cross-row condition a `CHECK`
cannot express. A trigger could, but it cannot produce the *named* refusal FR-003a requires, and the
project has no triggers to follow. Verified the existing data satisfies the rule with **zero exceptions**
(58 individual and 7 student accounts, all solo), so the migration needs no remediation path.

## R5 — Level on a gate dues line

**Decision**: `gate_sales` gains a nullable `membership_level`, set only on `membership` lines; the Zod
schema requires it there, as it already requires `contactId`.

**Rationale**: The gate line is where the FS records what was bought, and FR-003 makes level independent of
amount — the amount stays exactly as it is for the money reconciliation. Nullable because the column is
meaningless on the other six categories. `putGateSales` already refuses a membership line without a
contact; requiring the level in the same place keeps one validation story.

## R6 — Where the FS records dues outside the door

**Decision**: On the **payer's contact record**, alongside the account block that FR-018/FR-019/FR-022/
FR-023 already put there.

**Rationale**: Everything the FS needs to do to an account — record a payment, change the level, attach or
remove members — is about one household, and the payer's record is where that household is already shown.
A separate admin page would duplicate the search-and-find step the record already solves. It also means
FR-006 costs a form rather than a screen.

**Alternatives considered**: a standalone memberships page — rejected as a second place to look for the
same thing (Constitution II).

## R7 — Migration of the existing 154 rows

**Decision**: Group `memberships` by payer → one account each; attach every distinct member contact; take
`MAX(expiry_date)` and the group's single level. Resolve contact-less payers per FR-021 (match by name,
else create and flag `needs_review`). Then drop `memberships` and `payers`.

**Rationale**: Measured before designing: level and expiry are consistent within **all 31** multi-member
groups and every payer group overall — zero conflicts, so `MAX` is a formality rather than arbitration.
154 rows over 115 payer groups, 152 distinct member contacts. The only judgement is the 17 contact-less
payers holding 25 memberships, which FR-021 settles.

**Alternatives considered**: a dual-write period with both models live — rejected at this scale; 154 rows
migrate atomically in one transaction, and a dual-write window would create exactly the two-sources-of-
truth problem the feature removes.

## R8 — Preventing new ownerless accounts

**Decision**: Add account ownership to `CONTACT_DELETE_BLOCKERS`, reusing the mechanism feature 067
extended, with a human label via `BLOCKER_LABELS`.

**Rationale**: `membership_accounts.payer_contact_id` is a plain column on a table keyed by contact, so it
rides the **generic** blocker list directly — unlike 067's `shared_email`, which needed a bespoke join.
The label work already exists from the 067 follow-up, so FR-009a costs one map entry. This closes the
mechanism that produced the contact-less payers in the first place: today a payer's contact link is
*cleared* on delete rather than the delete being refused.

## R9 — Why the legacy tables are not dropped in this feature

**Decision**: `memberships` and `payers` stay. The drop moves to a follow-up.

**Rationale**: `ensureSchema` applies every migration to the test database, so a drop migration would make
the migration test unrunnable — it seeds old-shape rows to prove that no coverage was lost, and those
tables would no longer exist. Shipping the drop here would end the feature by deleting the guard on its
riskiest work. Unread tables cost nothing, and they remain the rollback position for the data move.

**Alternatives considered**: rewriting the migration test against fixtures rather than the real tables —
rejected as testing a reconstruction of the input instead of the input, on the one task where fidelity to
the real shape is the whole point.
