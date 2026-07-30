# Quickstart: Door-attendant check-in experience

Validation scenarios per user story. Integration tests run against **real Postgres** (node env); component
tests use the jsdom harness (feature 020). No migration to run.

## Prerequisites

- `pnpm run db:migrate` is already current (this feature adds **no** migration).
- Run the suite with `pnpm test`; a single file with `pnpm exec vitest run tests/<path>`.

## US1 — Correct a roster entry (P1)

**Integration** (`tests/integration/attendance.corrections.test.ts`):

1. Check in a matched person (with children), an unmatched admission, and note `events.attendance_count`.
2. **Delete** the matched record → row gone, `attendance_count -= (1 + children)`.
3. **Edit children** on a record → `attendance_count` moves by exactly the delta.
4. **Reassign** the unmatched admission to a contact → `contact_id` set; reassigning to a contact **already on
   the event** is refused (no duplicate).
5. **Toggle open-band** on a community-dance record → `is_open_band` flips and `door_records.open_band_count`
   moves ±1; toggling on for a non-community-dance event (or a booked performer) is refused.
6. **comp / gift ±1** → `door_records.comp_count` / `gift_card_redemption_count` moves by ±1, never below 0.
7. **Move** a dancer to a same-group sibling → source count down, target up by `(1+children)`; a move to a
   non-sibling event is **refused**.

**Expected**: after any sequence, `events.attendance_count` equals present admissions + their children (no
drift); every refusal names its cause.

## US2 — Land on the right event (P1)

**Integration** (`tests/integration/events.ordering.test.ts`): `listEvents` returns events ordered by date then
start time, descending.

**Component** (`tests/component/checkin.selector.test.tsx`): with events before/on/after today, the selector
pre-selects the most recent event ≤ today and renders each option as **date + start time + label** (time shown
`HH:MM`).

## US3 — One-line check-in (P2)

**Integration** (`tests/integration/attendance.unmatchedChildren.test.ts`): an **unmatched** admission with
`childrenCount` lands the children in `events.attendance_count` (previously dropped).

**Component** (`tests/component/checkin.inlineRow.test.tsx`): comp/children/confirm render on each candidate row
(matched / new-contact / unmatched); after a confirmed check-in, focus returns to the search box.

## US4 — Staff nav on home (P2)

**Component** (`tests/component/home.staffNav.test.tsx`): signed in, the home page shows the role-aware staff
nav (with Check-in) distinct from the public content; anonymous, it does not.

## US5 — Retire the "open door record" button (P3)

**Component** (extend the check-in test): a fresh event with no door record still checks in the first dancer
with no manual "open door record" control present.

## Full gate (solo-maintainer mode)

`pnpm exec tsc --noEmit` · `pnpm exec eslint <changed>` · `pnpm exec prettier --check <changed>` · `pnpm test`
· `pnpm build` — all green before the single atomic commit.
