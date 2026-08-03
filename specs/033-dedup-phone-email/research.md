# Research: Dedup review shows phone + email (P5-R7)

No open `NEEDS CLARIFICATION` — a small display-only feature; the spec's Assumptions resolve the few choices.
Decisions below record the grounded approach.

## R1 — Extend the suggestion payload (phone from the row; active emails via a subquery)

**Decision**: In `getMergeSuggestions` add `a.phone` / `b.phone` to the existing SELECT, and add each
candidate's **active** emails via `ARRAY(SELECT ce.email::text FROM contact_emails ce WHERE ce.contact_id =
a.id AND ce.status = 'active' ORDER BY ce.is_login DESC, ce.created_at)` (mirrored for `b`). `MergeSuggestion`
gains `phone: string | null` and `emails: string[]` per candidate.

**Rationale**: `contacts.phone` is already canonical (feature 032), so it's a plain column. `ARRAY(subquery)`
yields an **empty array** (not NULL) when a contact has no active email — clean to render. Ordering
`is_login DESC` surfaces the login/primary address first. All in the one existing query — no second round-trip,
no TS grouping.

**Alternatives considered**: A separate emails query grouped in TS — rejected (an extra round-trip; the
subquery is simpler and keeps it one query). `array_agg` — rejected (returns NULL for zero rows; `ARRAY(...)`
gives `{}`).

## R2 — Matching stays byte-for-byte unchanged (display-only)

**Decision**: Touch **only** the SELECT list. The `JOIN … ON a.id < b.id AND … a.dedup_normalized %
b.dedup_normalized`, the `WHERE similarity(...) >= threshold`, and `ORDER BY sim DESC LIMIT` are unchanged.

**Rationale**: FR-004 — the set and order of proposed pairs must be identical. Adding SELECT columns cannot
change which rows match or their order. An integration test asserts the pair set/order is unchanged versus the
pre-change query.

**Alternatives considered**: Also matching on phone/email — explicitly deferred (Q14, backlog).

## R3 — Display: reuse `formatPhone`; list active emails; clear empties

**Decision**: The `/dedup` page renders each candidate's phone through **`formatPhone`** (from
`src/server/domain/contacts/phone.ts`, feature 032 — its first live consumer): US → dashed, non-US keeps its
country code, raw/unparseable passthrough. Emails render as a list of the active addresses; a candidate with
no phone shows "no phone" and with no active email shows "no email" (muted, not a blank that reads as an
error). The `Pair` type mirrors the extended `MergeSuggestion`; the merge controls / empty state / access
rule are unchanged.

**Rationale**: FR-002/003/006. `formatPhone` is a pure function safe to import into the client page. Reusing
it keeps phone display consistent with the rest of the app (once other surfaces adopt it) and avoids a second
formatter.

**Alternatives considered**: Formatting the phone server-side in the payload — rejected (the page also wants
the reviewer to see the value; a pure client formatter keeps the payload canonical and matches how 032
intended `formatPhone` to be used).
