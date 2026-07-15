# Phase 1 Data Model: Reusable Band Roster

Storage: PostgreSQL 16. Builds on feature 003 (`performers`, `bookings`) and feature 009 (the
`musician` rate kind in `series_parameters`, already shipped). Two new tables plus one nullable
column on the existing `bookings` table.

## Entity: Band

| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| name | text NOT NULL | band's public name |
| bio | text NULL | band's own bio, independent of any member's (FR-009) |
| photo_url | text NULL | band's own photo, independent of any member's (FR-009); URL, same lightweight pattern as `performers.photo_url` |
| archived_at | timestamptz NULL | soft-delete marker (Decision 2). NULL = active/selectable; set = archived, excluded from the pick list but still resolvable for past-event display |
| created_at | timestamptz NOT NULL default now() | |
| updated_at | timestamptz NOT NULL default now() | |

- Identity is **live**: display always reads the current row (Decision 2). Editing name/bio/photo
  changes display everywhere; there is no per-event snapshot.
- "Delete" = `UPDATE bands SET archived_at = now()` — never a hard `DELETE` (FR-011).

## Entity: BandMember (roster)

| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| band_id | uuid FK→bands ON DELETE CASCADE NOT NULL | |
| performer_id | uuid FK→performers ON DELETE RESTRICT NOT NULL | roster member; drawn from existing Performers (FR-001) |
| is_lead | boolean NOT NULL default false | exactly one true per band (Lead Musician); enforced in the service |
| created_at | timestamptz NOT NULL default now() | |

- **Unique**: (band_id, performer_id) — a performer appears at most once in a given band's roster.
- A performer may be in many bands (FR-006) — no global uniqueness on performer_id.
- **Service invariants**: a band has exactly one `is_lead = true` member at all times; reassigning the
  lead flips booleans within the band (Decision 1). Roster edits are current-state (no history).
- CASCADE on band delete is moot in practice (bands soft-delete); RESTRICT on performer keeps a
  roster from silently losing a member if a performer row were ever removed.

## Extension to feature 003: `bookings.band_id`

| Field | Type | Notes |
|---|---|---|
| band_id | uuid FK→bands NULL | set only for bookings created via book-as-unit; null for individually-added bookings (Decision 3) |

- **Index**: (event_id, band_id) — supports the public grouping query.
- Powers FR-007 (public band grouping) and FR-004 (traceability that survives roster edits). Never
  nulled by a delete, since bands soft-delete (Decision 2).

## Behavior: book-as-unit (bookBand)

Given `(eventId, bandId, optional per-member pay)`:

1. Load the band's current roster (`band_members` for `band_id`).
2. Drop any member with an existing `bookings` row for `(eventId, performer_id)` — skip, no error
   (FR-003c).
3. For each remaining member, call the existing `createBooking` with `performerType` = lead_musician
   (for the `is_lead` member) or musician (others), the confirmed per-member pay (or none → default),
   and `band_id = bandId`. All in one transaction (Decision 5).
4. Return `{ createdCount, skippedCount }`.

- Pay default per member follows feature 003/009's existing chain inside `createBooking`: explicit
  override → series `musician` rate (`resolveParameterCents`) → 0. No new rate logic (Decision 6).

## Computed view: PublicEventPerformers (not persisted; for feature 007)

Given an event, `groupEventBookingsForDisplay(db, eventId)` returns:

- **bandBlocks**: one per distinct non-null `bookings.band_id` on the event — the current band's
  `{ name, bio, photoUrl }` (live read, Decision 2). Does NOT list individual members (FR-007).
- **adHoc**: bookings with `band_id = null`, displayed per feature 007's existing per-musician rules
  (FR-008).
- Two different bands on one event → two separate band blocks (US3 scenario 5). A band block plus a
  null-band booking → one block + one ad-hoc entry (US3 scenario 4).
- This is a read model only; the actual public page is feature 007's job (see plan Scope note).

## Relationships

- Band 1—N BandMember; BandMember N—1 Performer (feature 003)
- Band 1—N Booking via `bookings.band_id` (nullable; only book-as-unit bookings)
- Event 1—N Booking (feature 003, unchanged) — grouping reads the event's bookings by `band_id`

## Derived / non-persisted

- Band display identity is always derived live from the current `bands` row — never snapshotted
  (Decision 2). The only persisted new state is the two tables + `bookings.band_id`.
