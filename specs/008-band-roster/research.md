# Phase 0 Research: Reusable Band Roster

Stack fixed by build 1 (TS/Next.js + Postgres). `/speckit-clarify` resolved the skip-already-booked
rule and the live-vs-frozen band-identity question (both recorded in spec.md `## Clarifications`).
The decisions below record the resulting design plus choices settled during planning.

## Decision 1 — Roster as `band_members` with an `is_lead` flag, not a lead FK on `bands`

- **Decision**: `band_members (band_id, performer_id, is_lead)` with a unique (band_id, performer_id).
  The lead is the single row with `is_lead = true`; reassigning the lead flips booleans. The service
  enforces exactly one `is_lead = true` per band.
- **Rationale**: Reassigning the lead is a common edit (FR-002); with a `bands.lead_performer_id` FK
  plus a separate members table, reassignment means moving a performer between the FK and the join
  table (two writes, easy to get inconsistent). One `band_members` table with a boolean is simpler and
  makes "the roster" a single query.
- **Alternatives considered**: `bands.lead_performer_id` + `band_members` for non-leads — rejected
  (awkward reassignment, roster split across two places). A `role` enum instead of a boolean —
  unnecessary; there are only two states and feature 003 already maps both to the `musician` rate.

## Decision 2 — Live band identity; delete is a soft-delete/archive (clarify)

- **Decision**: Public/admin display always re-reads the **current** `bands` row. Editing a band's
  name/bio/photo changes how it appears on all its events, past and future. "Deleting" a band sets
  `archived_at` (soft-delete): the row persists so already-booked events still resolve its identity,
  but it is excluded from the directory used to pick a band for a new booking.
- **Rationale**: The spec states "current-state only, no history" three times (Assumptions + Band
  entity); the user confirmed the **Live** option during planning. Soft-delete is what reconciles
  "deleting is allowed" (FR-011) with "past-event display is unaffected" (deletion edge case) under a
  live-read model — a hard delete would break past display, and per-event snapshotting was explicitly
  rejected.
- **Consequence**: SC-004 was reworded (spec.md) to cover the booking facts (who was booked, what
  they were paid — immutable via the already-created booking rows) rather than the band's display
  identity (which is intentionally live). No per-event snapshot table exists.
- **Alternatives considered**: Snapshot name/bio/photo per book-as-unit action — rejected by the user
  (heavier, contradicts the no-history intent). Hard delete with `bookings.band_id` SET NULL —
  rejected (loses past-event branding, and SET NULL "alters a booking," violating FR-011).

## Decision 3 — The booking→band link is a nullable `band_id` on the existing `bookings` table

- **Decision**: Add `bookings.band_id uuid NULL REFERENCES bands(id)`. It is set only for bookings
  created via book-as-unit; individually-added bookings leave it null and display ad-hoc (FR-008).
  Because bands soft-delete (Decision 2), this FK is never nulled out by a delete.
- **Rationale**: The link is exactly what powers public grouping (FR-007) and survives roster edits
  (FR-004) — it records "this booking came from that band," independent of the band's current roster.
  Putting it on the existing booking row (rather than a separate join) keeps the grouping query a
  simple `GROUP BY band_id`.
- **Alternatives considered**: A separate `band_bookings` link table — unnecessary indirection; one
  nullable column on the row bookings already have is simpler.

## Decision 4 — Book-as-unit reuses `createBooking`; only adds the skip-already-booked filter

- **Decision**: `bookBand(db, eventId, bandId, perMemberPay?)` loads the band's current roster,
  filters out any member who already has a booking on that event (FR-003c), and calls the existing
  `createBooking` once per remaining member — passing `band_id` so the link is set. Per-member pay
  follows feature 003/009's existing default chain inside `createBooking`: an explicit override →
  else the series `musician` rate via `resolveParameterCents` → else 0. The propose-the-first-amount
  behavior (FR-003b) is a UI convenience computed client-side before submit; the server just receives
  whatever per-member pay the booker confirmed.
- **Rationale**: Reusing `createBooking` means per-type pay/check rules and the `musician`-rate
  default (feature 009) are inherited with zero duplication — the only genuinely new server logic is
  the skip filter. Lead Musician and Musician already share the `musician` rate in `PERFORMER_RULES`
  (feature 009), so booking a lead vs. a member differs only in `performerType`.
- **Skip detail**: "already booked on that event" = an existing `bookings` row with the same
  `(event_id, performer_id)`. Skipped members produce neither a row nor an error (per clarify); the
  response reports how many were created vs. skipped so the UI can show it.
- **Alternatives considered**: Re-implementing pay resolution inside `bookBand` — rejected (would
  duplicate 003/009 logic and drift). Adding a DB unique (event, performer) constraint — out of scope
  and would change feature 003 behavior for individual bookings; the skip is a band-flow concern only.

## Decision 5 — `bookBand` and band roster edits run in a transaction

- **Decision**: `bookBand` wraps its per-member `createBooking` calls in one transaction; band
  create/patch (which may write the `bands` row plus multiple `band_members` rows and must maintain
  the one-lead invariant) also runs transactionally.
- **Rationale**: A partially-booked band (some members inserted, then a failure) or a roster left with
  zero or two leads would be corrupt state. `createBooking` accepts a `Db` today; the plan uses the
  transaction handle (`DbOrTx`) so the loop is atomic — a small, existing-pattern refactor.

## Decision 6 — Musician rate default is already delivered by feature 009 (no work here)

- **Decision**: FR-012 (series-scoped `musician` rate) and FR-013 (Lead Musician and Musician share
  identical pay/check/display treatment) require **no implementation** in this feature — feature 009
  shipped the `musician` rate kind, made rates series-scoped, and set both `lead_musician` and
  `musician` to `rateKind: "musician"` in `PERFORMER_RULES`. FR-003a's "standard Musician rate in
  effect for the event's series" resolves today via `resolveParameterCents({ category: "rate", kind:
  "musician", seriesId, onDate })`.
- **Rationale**: The spec still describes FR-012/013 in future/BACKLOG-B16 terms because it was
  written before 009 was implemented. Treat them as satisfied prerequisites. Tasks should include a
  regression check that a Musician/Lead Musician booking defaults to the series rate (proving the
  band flow inherits it), not a re-implementation.
- **Alternatives considered**: None — this is a factual reconciliation, not a design choice.

**Output**: research complete; no NEEDS CLARIFICATION remain. Ready for data-model and contracts.
