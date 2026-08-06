# Phase 0 Research: Organizer Report Band Name (+ member detail)

No NEEDS CLARIFICATION remained in Technical Context. This records the design decisions and the code they are
grounded in.

## Decision 1: Resolve the band name from a `bandId → name` map loaded once

- **Decision**: At the top of `assembleOrganizerReport`, load all bands into a `Map<bandId, name>`
  (`db.select({ id, name }).from(bands)`). Per dance, resolve the band identifier from the booked musicians'
  `bandId`s via that map.
- **Rationale**: Each `BookingView` already carries `bandId` (it is `BookingRow & { performerName }`), and the
  bookings-report already resolves a booking's `bandId` to `bands.name` (its `db.query.bands.findFirst` per row).
  The organizer report loops over many events, so a single batched map avoids an N+1 across the year. `bands` is a
  small table.
- **Alternatives considered**: `getBand(db, bandId)` per distinct band per event (the public-display pattern) —
  rejected as N+1 across a full-year report. Snapshotting the band name on the booking — rejected (no schema
  change; band identity is a live read, consistent with the bookings/public reports).

## Decision 2: Band-identifier resolution rules (per dance)

- **Decision**: Among the dance's **lead-musician + musician** bookings, collect the **distinct non-null
  `bandId`s**.
  - ≥1 distinct band → the band identifier is those bands' **names**, joined (`", "`) if more than one (FR-001,
    FR-004).
  - No `bandId` but musicians present (ad-hoc) → **joined member names**, exactly as today (FR-002).
  - No lead/musician bookings but an **open-band** musician present → **"Open Band"** (FR-003).
  - Otherwise → **blank** (FR-003).
- **Rationale**: Directly encodes the spec's cases. A **mixed** dance (a named band plus an extra individually
  booked musician) shows the band name(s) in the column; the extra musician still appears in the detail's member
  list (spec edge case).
- **Alternatives considered**: Requiring a band (rejecting ad-hoc) — rejected; ad-hoc bookings are legitimate and
  must keep working. Showing band name *and* ad-hoc names together in the column — rejected as noisy; the column
  is the at-a-glance identifier, the detail carries the full roster.

## Decision 3: Non-band fallbacks are unchanged

- **Decision**: Joined member names / "Open Band" / blank are the exact current outputs for the non-band cases.
- **Rationale**: FR-002/FR-003 — only the *named-band* case changes; everything else is byte-for-byte as today, so
  existing behavior (and any test relying on it) is preserved.

## Decision 4: The "detail pop-up" reuses the existing inline per-dance expansion

- **Decision**: The organizer page already expands a clicked row to a detail that lists each performer as
  `name (type, amount)`. Keep that; add the **band name** as a label in the expansion. No new modal.
- **Rationale**: The member roster is already surfaced by name and role (type) — US2's core is met by the existing
  UI once the service change lands. Adding the band name makes the drill-in band-aware with a one-line change
  (`r.band` is already on the row). Introducing a separate modal would be redundant UI churn (YAGNI).
- **Alternatives considered**: A dedicated modal overlay — rejected (the inline detail already delivers the value;
  a modal is a UI-only swap deferred to `/speckit-clarify` if the organizer prefers it). Grouping members under
  their band inside the detail — deferred (nice-to-have; the flat `performers` list already names each member and
  their role, and multiple bands on one dance are rare).

## Decision 5: Display-only — no schema, no endpoint, no figure change

- **Decision**: Reads only. The organizer report route is unchanged; `band` stays a `string`. `performers[]` is
  unchanged.
- **Rationale**: The `bandId` and performer names are already loaded; only the derivation of the `band` string
  changes. Figure parity (FR-005/FR-008, SC-004) holds trivially because no computed value is touched.

## Out of scope (recorded, not researched)

- The public `/whats-on` band display (already shows band blocks) and the **bookings** report — R11 is the
  **organizer** report only.
- Changing how substitutions / no-shows are recorded or displayed — the report reflects current bookings as today.
