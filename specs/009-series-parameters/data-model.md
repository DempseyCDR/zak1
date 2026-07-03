# Phase 1 Data Model: Series-Scoped Rate & Expense Parameters

Storage: PostgreSQL 16. Consolidates feature 003's `rate_parameters`/`rate_parameter_audit` and
feature 005's `series_expense_parameters` into one entity; retrofits `performerRules.ts` (feature
003) with a new rate kind. Builds on `series` (feature 002, unchanged shape — just one new row).

## Enums

- `parameter_category`: `rate` | `expense`
- `parameter_kind`: `caller` | `sound_tech` | `musician` | `rent` | `ongoing`
  - `rate` category uses `caller` | `sound_tech` | `musician`
  - `expense` category uses `rent` | `ongoing`
  - (Enforced by the two separate Zod schemas at the API boundary, per research Decision 6 — the
    database enum itself doesn't need a CHECK constraint tying category to a kind subset, since
    nothing writes to this table except the two validated creation paths.)

## Entity: SeriesParameter (append-only, effective-dated)

| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| category | parameter_category NOT NULL | `rate` or `expense` |
| kind | parameter_kind NOT NULL | one of the 5 values |
| series_id | uuid FK→series NOT NULL, ON DELETE CASCADE | **mandatory for every category** — no nullable/global case (research Decision 2) |
| amount_cents | integer NOT NULL | |
| label | text NULL | expense-only in practice (e.g., "Equipment Depreciation"); always null for rate rows |
| effective_date | date NOT NULL | applies to events/bookings on/after this date |
| created_at | timestamptz NOT NULL default now() | |

- **Index**: (series_id, category, kind, effective_date DESC) — supports the resolver's lookup.
- **Resolution** (`resolveParameterCents`): for a given (category, kind, series_id, on_date), the row
  with the greatest `effective_date ≤ on_date`; none → 0. Identical rule for every category/kind —
  no branching (research Decision 5).
- Changes are append-only (never edited in place); a new row with a later `effective_date`
  supersedes the prior one going forward only (FR-002/FR-010).

## Entity: SeriesParameterAudit (append-only)

| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| category | parameter_category NOT NULL | |
| kind | parameter_kind NOT NULL | |
| series_id | uuid FK→series NULL, ON DELETE SET NULL | **nullable** — only for migrated pre-series-scoping legacy rate history (research Decision 3); every new row going forward has a real series_id |
| amount_cents | integer NOT NULL | |
| label | text NULL | |
| effective_date | date NOT NULL | |
| actor | text NULL | matches existing `actor: string \| null` convention (no auth in this build) |
| created_at | timestamptz NOT NULL default now() | |

- Written alongside the existing pino `writeAudit` call for every parameter creation, for both
  categories alike (expense gains this table; rate already had its own version of it).

## Extension: `general` series

| Field | Value |
|---|---|
| key | `general` |
| name | `General / Joint Events` |
| has_sound_tech | `true` |

- Seeded once by this feature's migration (`ON CONFLICT (key) DO NOTHING`), same mechanism as the
  existing 3 series (`tnc`, `ecd`, `community_dance`). No schema change to `series` or `events` — an
  event can already reference any series row via its existing `series_id` FK; `general` is simply one
  more valid value, usable for joint/cross-series events (FR-004).
- No automatic fallback to or from `general` — it must have its own explicit `SeriesParameter` rows
  like any other series (Edge Case, User Story 4 Scenario 2).

## Migration / backfill mapping (one-time, same migration)

| Source | Target | Mapping |
|---|---|---|
| `rate_parameters` (kind, amount_cents, effective_date, created_at) | `series_parameters` | **Cross join** against every `series` row (including the new `general`): one target row per (source row × series) — category='rate'. Preserves today's "applies to every series" behavior exactly (research Decision 3). |
| `series_expense_parameters` (series_id, kind, amount_cents, label, effective_date, created_at) | `series_parameters` | 1:1 carry-over, category='expense' (already series-scoped, nothing to duplicate). |
| `rate_parameter_audit` (rate_kind, amount_cents, effective_date, actor, created_at) | `series_parameter_audit` | 1:1 carry-over, category='rate', **series_id = NULL** (a single historical event, not duplicated per series — research Decision 3). |
| — (expense had no audit table) | — | Nothing to migrate; expense parameter changes only gain durable audit going forward, not retroactively. |

After backfill: `rate_parameters`, `rate_parameter_audit`, `series_expense_parameters` tables and the
`rate_kind`, `series_expense_kind` enums are dropped in the same migration.

## Extension: PerformerRule (feature 003, `performerRules.ts`)

| Performer type | `rateKind` before | `rateKind` after |
|---|---|---|
| caller | `"caller"` | `"caller"` (unchanged) |
| sound_tech | `"sound_tech"` | `"sound_tech"` (unchanged) |
| lead_musician | `null` | `"musician"` |
| musician | `null` | `"musician"` |
| open_band_musician, instructor | `null` | `null` (unchanged — always free) |

- `bookingService.ts`'s existing `else if (rule.rateKind) payCents = await resolveRateCents(...)`
  branch now also fires for Lead Musician and Musician bookings, calling
  `resolveParameterCents(db, { category: "rate", kind: rule.rateKind, seriesId: event.seriesId,
  onDate: event.eventDate })` — `event.seriesId` is already loaded at that call site (used just
  above it for the Sound Tech / Community Dance gate), so no new query is needed.

## Relationships

- Series 1—N SeriesParameter (both categories)
- Series 1—N SeriesParameterAudit (nullable for pre-migration legacy rate history only)
- Event N—1 Series (unchanged, feature 002) — resolution for a booking/report reads the event's
  existing `series_id`

## Derived / non-persisted

- Nothing about the *resolution* is persisted beyond the `SeriesParameter` rows themselves — pay and
  expense figures already computed on past bookings/reports are untouched by later parameter changes
  (FR-010), exactly as today.
