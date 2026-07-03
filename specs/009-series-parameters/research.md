# Phase 0 Research: Series-Scoped Rate & Expense Parameters

The core design (one table, mandatory series scoping, a `general` series instead of a nullable
fallback, migration must preserve existing behavior) was already settled in conversation before this
feature was formally specified (see BACKLOG.md B16 and the memory note it references). `/speckit-
clarify` found no remaining high-impact ambiguities. The decisions below record that design plus a
few concrete choices made during planning that weren't yet nailed down.

## Decision 1 — One table, one audit table, category + kind discriminators

- **Decision**: `series_parameters` (`category` enum `rate|expense`, `kind` enum
  `caller|sound_tech|musician|rent|ongoing`, `series_id` **NOT NULL** FK→series, `amount_cents`,
  `label` nullable, `effective_date`) replaces `rate_parameters` and `series_expense_parameters`.
  `series_parameter_audit` (same shape + `actor`) replaces `rate_parameter_audit` and gives expense
  changes an audit table they never had.
- **Rationale**: The two source entities are already identical in shape and resolution rule
  ("greatest effective_date ≤ target"); the only real difference was that expense already had
  `series_id`/`label` and rate didn't. One category column keeps rate/expense queryable separately
  without needing two physical tables.
- **Alternatives considered**: Keep two tables, just add `series_id`/`label` to `rate_parameters` —
  rejected; it leaves the resolver and audit-table duplication in place, which is the actual thing
  being consolidated.

## Decision 2 — `series_id` mandatory for rate too; `general` series, no fallback

- **Decision**: Rate parameters require a `series_id` exactly like expense parameters always have.
  A new `general` series (seeded by this feature's migration) covers joint/cross-series events.
  There is **no** automatic fallback from a specific series to `general`, or between any two series —
  every series that needs a rate/expense must have its own explicit row.
- **Rationale**: An earlier design considered a nullable `series_id` meaning "applies to every
  series"; this was explicitly rejected in favor of `general` being a real, ordinary series like any
  other; it keeps the resolver identical for every category/kind (no branching on whether `series_id`
  is null).
- **Alternatives considered**: Nullable `series_id` as a global-fallback sentinel — rejected (see
  above). Fallback lookup (try specific series, then `general`) — rejected; adds a second resolution
  path for no benefit once `general` exists as a normal, explicitly-configured series.

## Decision 3 — Migration must not change any existing series' resolved rate

- **Decision**: The migration backfills each existing `rate_parameters` row (Caller/Sound Tech) into
  `series_parameters` **once per existing series, including the new `general` one** — i.e., a cross
  join of today's rate rows against every series row. `series_expense_parameters` rows carry over
  1:1 (they already have a `series_id`). Old tables and enums (`rate_parameters`,
  `rate_parameter_audit`, `series_expense_parameters`, `rate_kind`, `series_expense_kind`) are
  dropped in the same migration, after the backfill.
- **Rationale**: Today, a single Caller rate applies uniformly across every series (there's no
  series-scoping at all yet); duplicating it into every series is the only way migration day doesn't
  silently change what an event resolves. This is a hard constraint (FR-005/SC-002), not a
  convenience.
- **Migrated audit history**: `rate_parameter_audit` rows are copied into `series_parameter_audit`
  **once each**, with `series_id = NULL` — they represent a single historical change event from
  before series-scoping existed; duplicating them 4× (once per series) would fabricate audit history
  that never happened. `series_parameter_audit.series_id` is therefore nullable, unlike
  `series_parameters.series_id` — new audit rows going forward always have a real series_id (every
  new parameter requires one); only this one-time migrated legacy history can be null.
- **Alternatives considered**: Leaving existing rates un-migrated / requiring organizers to
  re-enter them per series — rejected, directly violates FR-005.

## Decision 4 — Musician rate kind; Lead Musician and Musician share it identically

- **Decision**: Add `musician` to `parameter_kind`. `performerRules.ts`'s `PERFORMER_RULES` entries
  for both `lead_musician` and `musician` gain `rateKind: "musician"` (currently `null` for both —
  no standard rate exists for either role today).
- **Rationale**: Feature 008 (Band roster) needs a series-scoped Musician rate to default pay when
  booking a band; per that spec's FR-013, Lead Musician and Musician already share identical
  paid/check/display treatment in the current code (`PERFORMER_RULES` has always given them the same
  rule object apart from the enum label) — "Lead" is a booking-contact designation, not a pay tier.
  Sharing one rate kind is simply extending that already-true equivalence to cover pay defaults too.
- **Alternatives considered**: Separate `lead_musician` and `musician` rate kinds — rejected; nothing
  in either spec suggests they should ever pay differently, and it would contradict feature 008's
  FR-013.

## Decision 5 — One resolver function; no named per-category wrapper functions

- **Decision**: `resolveParameterCents(db, { category, kind, seriesId, onDate })` is the only
  resolver. `bookingService.ts` and `reportService.ts` call it directly (passing `category: "rate"`
  or `"expense"` and the relevant `kind`); the two GET routes (`/api/rate-parameters`,
  `/api/expense-parameters`) also call it directly and do their own response-shape formatting
  inline, exactly as they already do today.
- **Rationale**: `resolveRateCents`/`resolveExpenseCents` were near-identical already; a single
  function is simpler to test and maintain than one shared core plus two thin named wrappers that
  would add nothing beyond the two extra names.
- **Alternatives considered**: Keep `resolveRateCents`/`resolveExpenseCents` as thin wrappers for
  import-path stability — rejected; the call-site changes are one line each in `bookingService.ts`
  and `reportService.ts`, not worth the extra indirection.

## Decision 6 — Two Zod schemas / two API routes stay separate

- **Decision**: `rateParameterCreateSchema` (`src/server/validation/performers.ts`) and
  `expenseParameterCreateSchema` (`src/server/validation/organizer.ts`) remain two separate schemas
  and the two API routes (`/api/rate-parameters`, `/api/expense-parameters`) remain separate
  endpoints, both now backed by the same table and the same `seriesParameterService.ts`.
- **Rationale**: Even though both now require `seriesKey`, `kind`, `amount`, `effectiveDate`, they
  still validate different `kind` subsets (rate: caller/sound_tech/musician; expense: rent/ongoing)
  and expense alone has an optional `label`. A single polymorphic schema would need conditional
  requiredness for no real benefit — this app's existing convention (per the original B16 design
  discussion) is to keep the two surfaces distinct while sharing the underlying mechanism.
- **Alternatives considered**: One shared schema/endpoint gated by a `category` field — rejected as
  unnecessary complexity for two admin forms that are already conceptually distinct to the organizer.

## Decision 7 — Rate-parameters UI gains a series selector, a Musician option, and a resolved-preview

- **Decision**: `rate-parameters/page.tsx` adds a series `<select>` (populated from `GET /api/series`,
  mirroring `expense-parameters/page.tsx`'s existing pattern), adds "Musician" to the kind dropdown,
  and adds the same "currently in effect" resolved-preview section the expense page already has.
- **Rationale**: FR-002 makes series mandatory for rates, so the form must let the organizer choose
  one. FR-009 requires organizers to be able to see what's currently in effect; `expense-parameters`
  already has exactly this pattern, so mirroring it is the obvious, low-risk default — this was
  considered during `/speckit-clarify` and didn't need to be asked about, since there's really only
  one reasonable answer given the sibling page's existing precedent.
- **Alternatives considered**: Leave the rate-parameters UI without a resolved-preview — rejected,
  would make rate and expense parity inconsistent for no reason.

**Output**: research complete; no NEEDS CLARIFICATION remain. Ready for data-model and contracts.
