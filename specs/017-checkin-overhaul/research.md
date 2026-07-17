# Phase 0 Research: Check-in Overhaul

All spec-level unknowns were resolved in `/speckit-clarify` (Session 2026-07-17). This document records the
**design decisions** that follow from those clarifications and from reading the existing code, so Phase 1
(data-model / contracts) and Phase 2 (tasks) rest on settled ground. No open `NEEDS CLARIFICATION` remains.

## R1 — Open-band comp is a persisted per-event counter, not a derived one (B36)

**Decision**: Add a persisted `door_records.open_band_count`. Open-band check-in increments it (+1) and
`events.attendance_count` (+1). The organizer report computes `effectiveComps = comp_count + open_band_count`
and feeds that to `payingDancers`.

**Rationale**:

- The clarification chose "comp at each event, no cross-event counter." A sibling **single-event** persisted
  counter is fully consistent with that — still counts-only, still no cross-event ledger.
- The organizer report reads **persisted counters** (`events.attendance_count`, `door_records.comp_count`)
  because attendance rows **purge at 90 days** (feature 002). Deriving an open-band comp count from
  `attendance.is_open_band` rows at report time would silently drop to zero after the purge for any
  historical quarter. A persisted counter is the only correct home.
- Keeping it **separate** from `comp_count` avoids a write conflict: the Door Attendant flags open-band
  individually (per-person increment) while the FS confirms `comp_count` as an absolute number on `/gate`
  (`gate.write`). One shared column written by both a per-person delta and an absolute set would clobber.

**Alternatives considered**:

- *Reuse `comp_count` for open-band too* — rejected: the FS's absolute `comp_count` edit on `/gate` would
  overwrite per-person open-band increments; conflates two capture mechanisms.
- *Derive open-band comps from `attendance.is_open_band` at report time* — rejected: attendance rows purge
  at 90 days; the figure would vanish for historical reports.
- *Cross-event entitlement ledger (earned-here / redeemed-there)* — rejected in `/speckit-clarify` as
  over-engineering (YAGNI) and as breaking the counts-only, never-who rule.

## R2 — `attendance.is_open_band` is a per-row marker; `open_band_count` is the source of truth for math

**Decision**: Keep both. `is_open_band` on the attendance row drives the roster badge and marks *which*
check-in was open-band during the event's life; `door_records.open_band_count` is the persisted quantity the
report reads. Both are written in the same check-in transaction.

**Rationale**: The spec (FR-019/FR-020) says "flag a checked-in attendee as an open-band musician," which is
a per-attendee fact best carried on the attendance row. But because that row purges, the math cannot depend
on it (see R1). The two serve different lifetimes: display (ephemeral) vs. accounting (persisted).

**Community-dance gating (FR-022)**: the open-band flag is accepted only when the event's series is
`community_dance`. `series.key` is unique and `community_dance` is already seeded (`seed.ts`), peer to `tnc`.
The service looks up the event's series key and rejects `isOpenBand` on any other series.

**Booked-performer cross-check (FR-022a)**: the flag is also rejected when the contact is a booked performer
for that event. This is a **validation** cross-check against booking data, not detection — open-band
musicians are still identified manually (R-detection / FR-019). It exists because the paying-dancer
derivation subtracts performers *and* comps, so counting one person as both would double-subtract. It is the
only place this feature reads booking data.

## R3 — Children ride inside `attendance_count`; the paying-dancer formula is unchanged (B35)

**Decision**: Store `attendance.children_count` on the parent's attendance row and increment
`events.attendance_count` by `1 + childrenCount` at check-in. Do **not** change the `payingDancers` formula.

**Rationale**: `payingDancers = attendance − performers − 1 − comps`. Children are inside `attendance` and
are neither performers nor comps, so they are already counted as paying — exactly the required behaviour
(FR-011/FR-012) with no formula edit. `children_count` on the row exists for roster display, auditability,
and correct decrement if a family check-in is corrected. The persisted `attendance_count` (not the
purge-eligible rows) is what the report consumes, so families remain correct in historical quarters.

**Scope of the field**: `childrenCount` is accepted on the existing-contact and new-contact check-in paths
(a family has a parent contact), not on the `unmatched` path.

**Alternatives considered**: event-level aggregate counter (loses the parent link and roster display);
placeholder child attendance rows (manufactures contact-less rows, conflicts with counts-only). Both
rejected in `/speckit-clarify`.

## R4 — B29 comp/gift capture is an `attendance.write` concern, distinct from `gate.write`

**Decision**: New service `recordCheckinCounts(db, eventId, { compCount, giftCardRedemptionCount }, actor,
authz)` and route `POST /api/events/[id]/checkin-counts` requiring `attendance.write`. It `ensureDoorRecord`s
the event, asserts `attendance.write` event scope (layer 2), sets **only** `comp_count` and
`gift_card_redemption_count`, and audits. `/gate`'s existing `PATCH` (`gate.write`) still edits the same two
fields for the FS (FR-015 override); the two paths coexist because they touch disjoint responsibilities.

**Rationale**:

- The Door Attendant holds `attendance.write` (global) and `contact.write`/`contact.pii.read`, but **not**
  `gate.write`. The current `updateDoorRecord` asserts `gate.write` via `assertGateScope`, so it is off-limits
  to the Door Attendant. A separate, narrowly-scoped write is required to honour FR-018/FR-023.
- This is the exact split the `capabilities.ts` catalog comment anticipates: *"one record is written by
  different roles for different reasons … a door record's money vs. its comp counts."* The capability already
  exists; only the service + route are new.
- Precedent: `POST /api/events/[id]/door-record` already `ensureDoorRecord`s under `attendance.write`, so a
  Door Attendant creating/touching a door record (without money) is established.
- `ctx.actor` (the authz `Actor`) is provided by `withAuth`, so the new service can assert scope exactly as
  `updateDoorRecord` does.

**No double count with open-band**: `open_band_count` is a separate column, so a `comp_count` set here (or an
FS edit on `/gate`) never disturbs the open-band tally. `effectiveComps` sums the two at read time.

## R5 — B34 is a capture-gap close; the substrate is already present

**Decision**: Extend `attendanceSchema.newContact` with `lastName` (required in the UI, still schema-optional
to match the contract) and `displayNameOverride` (optional). `recordAttendance` passes both into
`deriveContactNames` and persists `display_name_override`. UI gains a last-name field and an editable
display-name field pre-filled with the derived "first last".

**Rationale**: `deriveContactNames` already accepts `displayNameOverride`, and `contacts` already has
`first_name`/`last_name`/`display_name_override`. The only gaps are the check-in **schema**, the **service**
passing the override through and setting the column, and the **UI** fields. Feature 012 did the hard part.

## R6 — Roster read enrichment + sort (B33)

**Decision**: Extend `listEventAttendance` to select `first_name`/`last_name` and accept a `sort` argument
(`'first' | 'last'`), ordering by the chosen field then the other as tiebreak (nulls last for placeholders).
Add a `?sort=` query param to `GET /api/events/[id]/attendance`. The `/checkin` page renders a roster panel
with a first/last sort toggle.

**Rationale**: The endpoint exists but was built for contact-tracing (display name only, no order). The
contact-tracing consumer (`contactTracingService`) uses only `count`, so adding fields/order is
backward-compatible. Structured names exist since feature 012.

**Compatibility note**: `EventAttendanceView.attendees` gains `firstName`/`lastName`; existing callers read
`count` and `displayName`, both retained.

## Summary of new/changed persistence

| Change | Table | Why |
|---|---|---|
| `children_count int NOT NULL DEFAULT 0` | `attendance` | B35 family count on the parent row |
| `is_open_band bool NOT NULL DEFAULT false` | `attendance` | B36 per-row open-band marker (roster) |
| `open_band_count int NOT NULL DEFAULT 0` | `door_records` | B36 persisted comp input (survives purge) |

All three are additive with safe defaults → historical rows and the organizer report are unchanged until the
new capture paths write them. Migration `0022_checkin_overhaul.sql` (additive; contrast 016's destructive
0021).
