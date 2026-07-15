# Phase 0 Research: Venue-Scoped Rent with Per-Event Override

No open **NEEDS CLARIFICATION** — the spec's two clarifications (rent hierarchy; multiple ongoing) and
the established stack settle the behavior. This records the design decisions the reshape requires,
including the two P2-2 questions the spec deferred here ("one table vs. split", "where the override
lives").

## Decision 1 — Rent leaves `series_parameters` into a venue-keyed `venue_rents` table

**Decision**: Create `venue_rents (id, venue_id FK→venues NOT NULL, series_id FK→series NULLABLE,
amount_cents, effective_date, created_at)`. A row with `series_id = NULL` is the **venue default**; a row
with a `series_id` is the **series-at-venue** override. Effective-dated like every other parameter.

**Rationale**: Rent's resolution dimension changed from *series* to *venue* (and (series, venue)), so it no
longer fits the series-scoped `series_parameters` shape. Encoding the two rent layers as one table with a
nullable `series_id` mirrors how the codebase already uses a nullable FK to mean "the general/default
case" (e.g. `series_parameter_audit.series_id`), and keeps a single effective-dated resolver.

**Alternatives considered**: Keep rent in `series_parameters` with new columns (rejected — pollutes a
series-scoped table with venue keys, and the resolver would branch on category); two separate tables for
venue-default vs. series-at-venue (rejected — needless duplication; nullable `series_id` is one clean
table).

## Decision 2 — Per-event rent is a nullable `events.rent_cents` column

**Decision**: Add `events.rent_cents integer NULL`. `NULL` = resolve from the venue/series layers; a value
= a per-event override (or a direct rent when the event has no venue).

**Rationale**: An event needs at most one rent override with no history of its own, so a single nullable
column is the minimal representation (Constitution II). Unlike a booking's `pay_cents` (which is always
materialized at booking time with an `is_overridden` flag), event rent must stay *dynamic* when unset so
that venue-rent edits flow through — hence `NULL`-means-resolve rather than always materializing. The
override is reached via the existing `PATCH /api/events/[id]`, so no new write path or audit table.

**Alternatives considered**: A dedicated `event_rents` table (rejected — YAGNI; no per-event rent
history required); a `pay_cents`+`is_overridden` clone (rejected — materializing would freeze events
against later venue-rent changes, the opposite of what unset events should do).

## Decision 3 — Rent resolution precedence

**Decision**: `resolveEventRentCents(event)` returns, most specific first:

1. `event.rent_cents` if non-null;
2. else, if the event has a venue: the latest `venue_rents` row for `(venue_id, series_id = event.series)`
   with `effective_date ≤ event.date`;
3. else, if the event has a venue: the latest `venue_rents` row for `(venue_id, series_id IS NULL)` with
   `effective_date ≤ event.date`;
4. else `0`.

**Rationale**: Directly encodes the clarified hierarchy (per-event → series-at-venue → venue default → 0).
The event row already carries `rent_cents`, `venue_id`, `series_id`, and `event_date` (the report selects
whole event rows), so no extra event fetch is needed.

**Alternatives considered**: A single SQL query with `ORDER BY series_id NULLS LAST` to pick series-at-venue
over default in one shot — viable and can be used internally, but the two-step form above is clearer and
the volume is tiny.

## Decision 4 — Multiple ongoing charges via a labeled sum (ongoing stays in `series_parameters`)

**Decision**: Keep ongoing in `series_parameters` (category `expense`, kind `ongoing`). Allow multiple
rows per series distinguished by **`label`** (now required for ongoing). New resolver
`resolveOngoingTotalCents(seriesId, onDate)` = sum over distinct labels of the latest amount with
`effective_date ≤ onDate` (Postgres `SELECT COALESCE(SUM(amount_cents),0) FROM (SELECT DISTINCT ON
(label) amount_cents ... ORDER BY label, effective_date DESC) t`). A `$0` latest-row for a label
contributes 0 — i.e. an ended charge.

**Rationale**: Ongoing is still series-scoped and effective-dated — it does *not* need a new table; only
the resolver changes from "single latest" to "latest-per-label, summed." Label becomes the charge
identity, which the data already carries (today's one "Supplies/insurance" line per series becomes one
charge, unchanged). Ending-by-zeroing falls out of the effective-dated sum for free.

**Alternatives considered**: A new `ongoing_charges` table with a stable charge id (rejected — a label is
a sufficient natural key at single-club scale, and reusing `series_parameters` keeps one audit trail and
one creation path); keeping a single ongoing amount (rejected — the clarification requires concurrent
charges).

## Decision 5 — Retain the `rent` enum value; delete active rent config; drop rent from the expense path

**Decision**: In migration `0016`, after freezing rent onto `events.rent_cents`, **delete** the active
`series_parameters` rows where `category='expense' AND kind='rent'`. **Keep** the `rent` value in the
`parameter_kind` enum (do not recreate the type). Remove `rent` from `expenseParameterCreateSchema` and
the expense-parameters admin.

**Rationale**: Historical `series_parameter_audit` rows record past rent changes with `kind='rent'`;
dropping the enum value would force deleting or rewriting that audit history. Retaining the value (dormant,
only in old audit rows) preserves history with far less churn, while the *config* rent rows are removed
because rent now lives in `venue_rents`/`events`. The go-forward write path no longer accepts `rent`, so
no new dormant surface is exposed to users.

**Alternatives considered**: Recreate `parameter_kind` without `rent` (rejected — it also backs
`series_parameter_audit.kind`, so removal means losing/rewriting audit history for a hygiene gain).

## Decision 6 — Migration freeze strategy for FR-007 / SC-004

**Decision**: For **every** existing event, set `events.rent_cents = COALESCE(<current resolved series
rent for that event's series+date>, 0)`. This freezes each event at exactly its current resolved rent,
including events that currently resolve 0.

**Rationale**: Guarantees byte-identical rent and Dance Net after migration regardless of whether an event
has a venue (FR-007/SC-004). Freezing even the 0-rent events prevents a later venue-rent setup from
retroactively changing an already-recorded event. Production loads fresh at go-live, so this only touches
seed/pre-go-live rows; the organizer can clear a future event's override to let venue rents flow.

**Alternatives considered**: Freeze only past-dated events, leaving future events dynamic (rejected —
future events would then resolve 0 until venue rents exist, changing their current figures); infer venue
rents from event history (rejected — events may lack venues; fragile, and per-event freeze is exact).

## Decision 7 — Audit parity for venue rents

**Decision**: Add `venue_rent_audit` mirroring `series_parameter_audit` (venue_id, series_id nullable,
amount_cents, effective_date, actor, created_at); `createVenueRent` writes it plus a pino `writeAudit`.

**Rationale**: Rent is financial config that moves report figures; it deserves the same durable, queryable
audit trail rate/expense parameters already have (Constitution IV). The per-event override rides the event
PATCH's existing audit (like a booking pay override), so it needs no separate table.

## Non-functional posture

Performance/scale/security/observability inherited and unaffected at single-club scale. Integration tests
run against real Postgres per the no-mock rule. The one real risk is the migration freeze; it is covered
by a dedicated before/after test and a manual quickstart check.
