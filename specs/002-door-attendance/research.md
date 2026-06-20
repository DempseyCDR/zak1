# Phase 0 Research: Door Attendance & Gate Capture

Stack is fixed by build 1 (TS/Next.js + Postgres, single-tenant). Decisions below resolve the
design choices specific to this feature. No NEEDS CLARIFICATION remain.

## Decision 1 — Money as integer cents

- **Decision**: Store all monetary amounts as `integer` cents; never floating point. A small
  `money.ts` helper handles parse/format and arithmetic; Zod coerces incoming dollar amounts to cents
  at the boundary.
- **Rationale**: Floating-point dollars accumulate rounding error; the POS fee (×2.29%) and deposit
  math feed the Treasurer Report (feature 004) and must reconcile exactly to the cent.
- **Alternatives considered**: Postgres `numeric` (exact, but heavier and easy to mishandle in JS as
  float); float (rejected — inexact).

## Decision 2 — POS fee calculation & concealment

- **Decision**: Fee = round(0.09 × 100 × transactions) + round(pos_gross_cents × 0.0229), computed
  server-side and stored on the door record. It is never included in any door-facing API response.
- **Rationale**: Spec FR-007 requires the fee be computed but hidden from the volunteer; storing it
  supports the Treasurer reconciliation line without recomputation later.
- **Alternatives considered**: Compute on demand in reporting (recompute risk / drift).

## Decision 3 — Minimal events/series model

- **Decision**: Introduce `series` (TNC, ECD, Community Dance, …; config rows) and `event` (a dated
  instance referencing a series, with an informational `charges_admission` flag). A door record
  belongs to exactly one event and is permitted for any event, including free ones. A same-evening
  Community Dance is a separate event → separate door record (FR-009). Free events
  (`charges_admission = false`) still track attendance and may record donations (FR-010); the flag
  drives UI/reporting only and never blocks a door record.
- **Rationale**: A door record must attach to *something* with a date and series for later reporting;
  this is the smallest anchor. Full scheduling/public listing is feature 007's concern.
- **Alternatives considered**: Put series/date directly on the door record (rejected — events are
  shared by features 003/005/007; a real entity avoids rework). Build full event scheduling now
  (rejected — YAGNI).
- **Event grouping**: add an `event_group` entity now (Double Dance, weekend festival, JAB), with an
  optional `group_id` on `event`. Only the grouping is in scope here; a single ticket redeemable
  across a group is deferred to feature 007 + door redemption. Adding the entity now avoids a later
  migration of the events model when group tickets land.

## Decision 4 — Gate sales shape

- **Decision**: One `gate_sales` row per (door_record, category, payment_method) with a cents amount;
  category ∈ 7 enum values, payment_method ∈ {cash, card}. Unique per combination.
- **Rationale**: Matches the spec's "each category separated by cash and card"; easy to sum per
  category and per method for both reports.
- **Alternatives considered**: Wide columns (14 amount columns on the door record) — rigid and
  awkward to extend; rejected.

## Decision 5 — Check-in: match / new / unmatched

- **Decision**: Reuse `contactService.searchContacts` for the ranked pick list. Attendance attaches to
  the **event** (not the door record), so any event can have attendance with no money recorded. Three
  outcomes: (a) select an existing contact → attendance row links it; (b) no match → create a contact
  flagged `needs_review` and link it; (c) decline → an attendance row with no contact (unmatched).
- **Rationale**: Reuses 001's tested trigram search (300 ms target) and create path; the review flag
  feeds the admin dedup/review queue (001). Decoupling attendance from the door record means a free
  event needs a door record only when donations are collected.
- **Alternatives considered**: Separate door-only person store (rejected — fragments the directory).

## Decision 6 — Retention: 90-day purge + permanent quarterly counts

- **Decision**: A daily purge job deletes attendance↔contact links older than 90 days, after first
  rolling each event's attendee count into a permanent `quarterly_attendance_counts` aggregate
  (series × year × quarter). Unmatched-attendance counts are included in the aggregate before purge.
- **Rationale**: Spec FR-011 — identifiable data is short-lived for contact tracing; aggregate counts
  persist for reporting (feature 005).
- **Alternatives considered**: Soft-delete/anonymize in place (rejected — simpler to purge links and
  keep aggregates; less PII retained).

## Decision 7 — Deposit calculation

- **Decision**: deposit_cents = gross_cash_cents − seed_float_cents − cash_paid_out_cents, computed
  and stored on save. Seed float defaults to 1500 cents ($15), overridable per door record.
- **Rationale**: Spec FR-008; deterministic and testable.

**Output**: research complete; ready for data-model and contracts.
