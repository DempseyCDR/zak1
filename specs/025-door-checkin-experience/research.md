# Research: Door-attendant check-in experience

Decisions resolving the plan's unknowns. No open `NEEDS CLARIFICATION` — the product decisions are settled in
the spec (from the Phase 4 requirements + the Meg check-in notes), and the code shape is confirmed by reading
the existing 017/016/010 implementation.

## R1 — No migration: the attendance shape already supports corrections

**Decision**: Add **no columns and no table**. The `attendance` row already carries everything a correction
needs — `children_count`, `is_open_band`, and a nullable `contact_id` — and `events.attendance_count` is
already the denormalized head count maintained on insert. Corrections are new **domain operations + routes**
over that shape.

**Rationale**: The schema comment on `attendance` literally anticipates this ("the row is for roster display
and **correct decrement on correction**"). Attendance is only take-only because there are no PATCH/DELETE
domain functions or routes yet — not because the data model is missing anything. Adding a migration would
violate YAGNI.

**Alternatives**: A dedicated correction/audit table — rejected (over-engineered; `writeAudit` already gives
traceability). Comp/gift columns on the attendance row — rejected (decision **B**: counts-only, un-attributed;
they stay on `door_records`).

## R2 — Per-record attendance mutations keep the denormalized count exact

**Decision**: Add to `attendanceService.ts`: `deleteAttendance(id)` → remove the row and
`events.attendance_count -= (1 + children)`; `patchAttendance(id, { childrenCount?, contactId?, isOpenBand? })`
→ on a children change adjust the count by the **delta**, on a reassign set `contact_id` (with the same
dup-guard `recordAttendance` uses), on an open-band toggle flip `is_open_band` **and** move
`door_records.open_band_count` by ±1; `moveAttendance(id, toEventId)` → decrement the source event and
increment the target by `(1 + children)`. Each runs in one transaction and is audited.

**Rationale**: FR-002/003/004/008/009. The head count is a **denormalized** integer (survives the 90-day
attendance purge, feeds the organizer report), so every mutation must adjust it in lockstep — exactly the
"correct decrement on correction" the schema anticipated. Reusing `recordAttendance`'s dup rule for reassign
keeps behavior consistent.

**Alternatives**: Recompute `attendance_count` from rows on each change — rejected (the count intentionally
outlives the rows; a live re-count would read zero after the purge and corrupt the report).

## R3 — Open-band toggle also moves the door-record count (and keeps the community-dance rule)

**Decision**: Toggling `is_open_band` in a correction mirrors what `recordAttendance` does at check-in:
`true` requires the event to be **community_dance** and the person **not a booked performer** (else refuse),
and increments `door_records.open_band_count`; `false` decrements it (floor 0). The attendance head count is
**not** touched (an open-band musician still counts as an admission).

**Rationale**: Open-band materializes into `door_records.open_band_count` at check-in (the report reads
effective comps = `comp_count + open_band_count`). A per-row toggle that ignored the door count would desync
the comp math. Keeping the community-dance guard matches FR-022.

**Alternatives**: Toggle only the row flag — rejected (would drift the open-band comp count).

## R4 — comp / gift are a ±1 on the door-record aggregate (decision B), not attendance edits

**Decision**: Add `adjustDoorCount(eventId, 'comp' | 'gift', +1 | -1)` to `doorRecordService.ts` — ensure the
door record, then move `comp_count` / `gift_card_redemption_count` by ±1, floored at 0, audited. Exposed to
`attendance.write` (it is Meg's per-roster correction, and `recordAttendance` already materializes comp/gift
under `attendance.write`).

**Rationale**: Decision **B** (counts-only, never attributed): there is no per-person comp/gift to edit, so a
correction is a nudge on the event aggregate. The FS's later gate override still supersedes for final money.

**Alternatives**: Per-person comp/gift columns + edit — rejected (revives B21/B29 attribution; explicitly
decided against).

## R5 — Move is bounded to a same-group sibling, server-validated

**Decision**: Add `getGroupSiblings(eventId)` to `eventService.ts` returning the **other** events sharing the
event's non-null `group_id` (`{ id, eventDate, startTime, seriesKey|label }`; empty when ungrouped), surfaced
at `GET /api/events/[id]/group-siblings` for the modal. The `moveAttendance` path **re-derives** the sibling
set on the server and refuses a target that is not in it — never trusting the client's list.

**Rationale**: FR-005/FR-006/FR-010. Same "server-validate the target, never trust the client" discipline as
024's band re-point. Group membership (`events.group_id` / `event_groups`, feature 010) is the exact boundary
for "wrong event within a group."

**Alternatives**: Free-form move to any event — rejected (out of scope; the real case is the same-day
community-dance ↔ contra pair).

## R6 — Children on the unmatched path: relax the validation, not the domain

**Decision**: Add `childrenCount` to the **`unmatched`** branch of `attendanceSchema` (today `.strict()`
rejects it). `recordAttendance` already reads `childrenCount` generically (`"childrenCount" in input`), so once
the schema admits it on the unmatched path the count flows into `events.attendance_count` with no domain
change. A test asserts an unmatched admission with children lands the head count. Open-band stays
person-and-community-dance only (unchanged).

**Rationale**: FR-015 / Meg note #6. The number was being **silently dropped** at the validation boundary; the
fix is one schema line + a regression test, not a domain rewrite.

**Alternatives**: Add a separate anonymous-with-children path — rejected (the union member already fits).

## R7 — Selection & entry polish: ordering in the service, default + label in the page; home nav via the optional actor

**Decision**:

- **Ordering (US2)**: `listEvents` gains `orderBy(desc(event_date), desc(start_time))` (today it has none). The
  check-in page selects the **default** (the newest event with `event_date ≤ today`) and renders each option as
  **date + start time + label**, applying the 020 `toHHMM` normalization to the `time` value.
- **Inline row (US3)**: move comp/children/confirm onto each candidate row (matched / new-contact / unmatched),
  retire the detached fieldset, and `focus()` the search box in the post-confirm reset.
- **Home nav (US4)**: `src/app/page.tsx` renders the role-aware `<Nav/>` **only when signed in**, using
  `getCurrentStaff()` (returns `null` for anonymous visitors) rather than `requireActor()` (which redirects) —
  kept as a separate element from the public content.
- **Cleanup (US5)**: delete the "open door record" button + handler; `recordAttendance` ensures the door record
  on first check-in and the gate ensures it independently, so the button is vestigial.

**Rationale**: FR-011..FR-014, FR-016, FR-017, FR-018. Each is a small, independently-testable change against a
known code location (confirmed by reading `eventService.listEvents`, `checkin/page.tsx`, `page.tsx`, `Nav.tsx`,
`currentStaff.getCurrentStaff`). The `time` column round-trips as `HH:MM:SS`, so the 020 normalization applies
(known regression class).

**Alternatives**: Client-side sort of an unordered list — rejected (ordering belongs in the query; other
consumers benefit too). A second Nav component for home — rejected (reuse the existing role-aware `Nav`).
