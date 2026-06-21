# Phase 0 Research: Performers & Bookings

Stack fixed by build 1 (TS/Next.js + Postgres). Decisions below resolve feature-specific design.
No NEEDS CLARIFICATION remain.

## Decision 1 — Performer type rules as a static table

- **Decision**: A `performerRules.ts` map keyed by performer type → `{ paid, requiresCheck,
  publicDisplay }` where publicDisplay ∈ `full_bio` | `open_band_label` | `hidden` | `name_note`.
  The booking service consults it to enforce/derive behavior.
- **Rationale**: The matrix is small and fixed; a data table is clearer and more testable than a class
  hierarchy (YAGNI). Keeps rules in one place for the public site (007) and treasurer report (004).
- **Alternatives considered**: Per-type subclasses (over-engineered); DB-stored rules (needless config
  surface — these rules are domain invariants, not per-club settings).

## Decision 2 — Performer identity vs. Contact

- **Decision**: `performer` is its own entity (name, optional bio, optional photo_url, optional
  `contact_id` link to feature 001). Not every performer is a club contact, and performers carry
  public bio/photo that contacts don't.
- **Rationale**: ~1,200 historical performers from the WordPress import; many are not CDR contacts.
  Linking is optional so a performer can later be associated with a contact.
- **Alternatives considered**: Performer as a flag on Contact (rejected — pollutes the contact model
  and forces every performer to be a contact).

## Decision 3 — Effective-dated rate parameters

- **Decision**: `rate_parameters (kind, amount_cents, effective_date)` where kind ∈ `caller |
  sound_tech`. The rate for a booking = the row with the greatest `effective_date <= event_date` for
  that kind. Changes are append-only (new effective-dated rows) and audited.
- **Rationale**: Matches FR-007/008; append-only history makes past bookings reproducible and avoids
  destructive edits. Mirrors the effective-date pattern used elsewhere (ongoing expense in 005).
- **Alternatives considered**: Single mutable rate row (loses history; breaks reproducibility).

## Decision 4 — Booking pay, donation, and override

- **Decision**: A booking stores `pay_cents`, `is_donated` (boolean), and `is_overridden` (boolean).
  On create, pay defaults to the resolved rate for the performer's role at the event date; the
  organizer may override (sets `is_overridden`). A donated booking is `pay_cents = 0, is_donated =
  true`. `requires_check` is derived: rule.requiresCheck AND pay_cents > 0 (so $0/donated and unpaid
  roles never require a check).
- **Rationale**: Captures FR-002/005/006 cleanly; donation vs. genuinely-unpaid (Open Band) are
  distinguished by type + is_donated, both excluded from YTD earnings.
- **Alternatives considered**: Infer donation from pay=0 only (can't tell a donated caller from an
  unpaid open-band slot for appearance-credit purposes).

## Decision 5 — Sound Tech on Community Dance & Instructor rules

- **Decision**: Booking service rejects a Sound Tech booking when the event's series has
  `has_sound_tech = false` (Community Dance). Instructor bookings are forced to `pay_cents = 0,
  requires_check = false` regardless of input.
- **Rationale**: FR-004/005 are hard invariants enforced server-side, not UI-only.

## Decision 6 — Appearance history & YTD earnings

- **Decision**: Appearance history = all bookings for a performer (including $0/donated). YTD earnings
  = sum of `pay_cents` for the performer's bookings in the calendar year where `is_donated = false`
  (and pay_cents > 0). Computed on read from bookings + event dates (not materialized).
- **Rationale**: Low volume; compute-on-read avoids materialization complexity (YAGNI). FR-010/SC-002.

## Decision 7 — Performer total per event

- **Decision**: Combined performer total = sum of `pay_cents` across an event's bookings; drill-down =
  the booking list. Computed on read; consumed by the Treasurer/Organizer reports (004/005).
- **Rationale**: FR-009/SC-004; single source of truth derived from bookings.

**Output**: research complete; ready for data-model and contracts.
