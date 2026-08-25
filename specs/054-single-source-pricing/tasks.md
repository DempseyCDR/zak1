# Tasks: Single-source admission pricing & standing schedule (P7-R10)

**Feature dir**: `specs/054-single-source-pricing/` · **Branch**: `054-single-source-pricing` (off `main`)
**Input**: plan.md, research.md, data-model.md, contracts/admission-pricing.md, quickstart.md, spec.md

**Constitution**: Test-First (NON-NEGOTIABLE) — the test task in each area precedes its implementation task.
**Additive migration `0037`** (0036 is 053's). **No new capability** (`parameter.write` already gates
rate/expense/door parameters). ⚠️ The **single-source invariant** — one `resolveEventPricing` → one
`PublicPricing` value, with the card summary **derived** from it — is the load-bearing property: card and
detail render the same value, so they can never disagree. Per-event override reuses `events.advertised_price_cents`
(018); audit via `audit_events` (`recordAudit`). No recurrence engine; no printable calendar.

## Phase 1: Setup

- [X] T001 [P] Add `admission_prices` to the `resetDb()` TRUNCATE list in `tests/integration/helpers/db.ts`
  (new table; `series` is already reset by re-seed).
- [X] T002 [P] Add `admission_pricing.set` to the `AuditEvent` `kind` union in `src/server/lib/audit.ts`.

## Phase 2: Foundational (the table, the resolver, the projection value — blocks all stories)

- [X] T003 Migration `src/server/db/migrations/0037_admission_pricing.sql`: `CREATE TABLE IF NOT EXISTS
  admission_prices (id uuid pk default gen_random_uuid(), series_id uuid NOT NULL REFERENCES series(id) ON
  DELETE CASCADE, label text NOT NULL, amount_cents integer NOT NULL, sort_order integer NOT NULL DEFAULT 0,
  effective_date date NOT NULL, created_at timestamptz NOT NULL DEFAULT now())` + index on
  `(series_id, effective_date)`; `ALTER TABLE series ADD COLUMN IF NOT EXISTS schedule_sentence text`.
  Snapshot `zak1_dev` first, then `pnpm run db:migrate`.
- [X] T004 Drizzle schema `src/server/db/schema/admissionPrices.ts` (mirror the table; export `admissionPrices`
  + `AdmissionPriceRow`) and export it from the schema index; add `scheduleSentence: text("schedule_sentence")`
  (nullable) to the `series` table in `src/server/db/schema/events.ts`.
- [X] T005 [P] Zod `src/server/validation/admissionPricing.ts`: `admissionPricingSetSchema`
  (`seriesId` uuid, `effectiveDate` `YYYY-MM-DD`, `tiers` non-empty array of `{ label: non-empty,
  amountCents: int ≥ 0 }`), `scheduleSentenceSchema` (`seriesId` uuid, `sentence: string | null`).
- [X] T006 [P] Unit test `tests/unit/publicPricing.test.ts`: `pricingFromTiers` (override amount → `{flat}`;
  tiers → `{tiers}`; **empty** tiers + no override → `null`) and `pricingSummary` (`flat → "$12"`; flat `$0` →
  `"Free"`; tiers → `"$5–$15"` over distinct non-zero amounts; single distinct → `"$12"`; a non-empty **all-`$0`**
  tier set → `"Free"` (configured-free, NOT `null`); `null → null`). Pure, no DB. (Test-first — fails until T009.)
- [X] T007 [P] Integration test `tests/integration/admissionPricing.resolve.test.ts` (real Postgres): seed a
  series with **two revisions** at different `effective_date`s and an event at a date between them; assert
  `resolveAdmissionTiers` returns the latest revision ≤ the event date (ordered by `sort_order`);
  `resolveEventPricing` returns those tiers, returns `{flat}` when the event's `advertised_price_cents` is set,
  and `null` when nothing is configured. (Test-first — fails until T008/T009.)
- [X] T008 Implement `src/server/domain/pricing/admissionPricingService.ts` — `resolveAdmissionTiers(db,
  seriesId, onDate)`: the max `effective_date ≤ onDate` for the series, returning all its tiers ordered by
  `sort_order` (`[]` if none). (Writers come in US2.)
- [X] T009 Implement `src/server/domain/public/publicPricing.ts`: `PublicPricing` union
  (`{kind:"flat";amount} | {kind:"tiers";tiers:{label,amount}[]} | null`, dollars); pure
  `pricingFromTiers(tiers, advertisedPriceCents)` (override amount → `{flat}`; **non-empty** tiers → `{tiers}`
  even when all `$0` — configured-free stays non-null; **empty** tiers + no override → `null`) and
  `pricingSummary(p)` (`flat → "$X"`, flat `0` → `"Free"`; tiers → range over distinct non-zero amounts, and an
  all-`$0` tier set → `"Free"`; `null → null`); and `resolveEventPricing(db, {seriesId, eventDate,
  advertisedPriceCents})` = `resolveAdmissionTiers` + `pricingFromTiers` (cents→dollars via `centsToDollars`).

## Phase 3: User Story 1 — A visitor sees one consistent price everywhere (Priority: P1)

**Goal**: the card (summary), event detail (tiers), series landing (tiers), and home strip all render the same
`PublicPricing`; no hand-typed price literal remains.
**Independent test**: configure a series' tiers; the home strip, a `/whats-on` card, the event detail, and the
series landing show the same pricing (card = derived summary), with no literal `$` on those surfaces.

- [X] T010 [P] [US1] Component test `tests/component/pricingBlock.test.tsx` (jsdom): `PricingBlock` renders a
  `{tiers}` value as a labelled list (incl. a `$0` "Musicians" tier), a `{flat}` value as one price, and
  **nothing** for `null`. (Test-first — fails until T011.)
- [X] T011 [P] [US1] Create `src/app/(public)/_components/PricingBlock.tsx` (+ `PricingBlock.module.css`):
  render a `PublicPricing` — tiers as `label — $amount` lines, flat as a single price, `null` as nothing.
- [X] T012 [US1] Wire `src/server/domain/public/publicSchedule.ts`: replace `advertisedPrice: number | null`
  with `pricing: PublicPricing` on `PublicScheduleItem` and `PublicEventDetail`, resolved via
  `resolveEventPricing` in `listPublicEvents` and `getPublicEventDetail`. The projection already joins `series`
  (select `events.seriesId` alongside the existing `series.key`) and selects `advertisedPriceCents` + the event
  date. **F3 (efficiency)**: `listPublicEvents` returns many events (esp. `/what-was-on`) — resolve each
  **series'** admission revisions **once** and pick the effective batch per event in memory (memoize by
  `seriesId`), not one `resolveAdmissionTiers` query per event (avoid the N+1). **F1 (rename fallout)**: update
  the existing fixtures/consumers that reference the old `advertisedPrice` projection field —
  `tests/component/scheduleList.test.tsx`, `tests/component/eventCard.test.tsx`, and
  `tests/component/publicLayout.test.tsx` (grep `advertisedPrice` under `tests/` + `src/app/(public)` to catch
  all); the DB/admin field `events.advertised_price_cents` and its 018 setter are unchanged.
- [X] T013 [US1] Update `src/app/(public)/_components/EventCard.tsx`: render `pricingSummary(item.pricing)`
  (replaces the `advertisedPrice` figure) — applies to `/whats-on`, `/what-was-on`, and the home strip.
- [X] T014 [US1] Update `src/app/(public)/whats-on/[eventId]/page.tsx`: render `<PricingBlock pricing={detail.pricing} />`
  in place of the inline `$advertisedPrice` line.
- [X] T015 [US1] Update `src/app/(public)/dances/[style]/page.tsx`: resolve the style's series tiers **as of
  today** (`resolveEventPricing` with no override) and render `<PricingBlock>`; **remove** the hard-coded
  "Cost: $5 per person, with a $15 family cap" literal from `src/app/(public)/dances/landingContent.ts` (FR-011).

## Phase 4: User Story 2 — Staff set a series' pricing once, effective-dated + audited (Priority: P1)

**Goal**: a `parameter.write` editor sets/updates a series' tiers effective a date; history is preserved and
each change is audited; non-editors are refused.
**Independent test**: set pricing effective a past date, then a later date; an event before shows the old
tiers, on/after shows the new; the edit writes an audit row; a base actor is refused.

- [X] T016 [US2] Integration test `tests/integration/admissionPricing.write.test.ts` (real Postgres):
  `setAdmissionPricing` inserts a revision (tiers share the `effective_date`, `sort_order` from array order)
  and writes an `audit_events` row (`admission_pricing.set`); `listAdmissionRevisions` returns revisions
  grouped by date with tiers ordered; a second revision changes what an event resolves by date.
  (Test-first — fails until T017.)
- [X] T017 [US2] Extend `src/server/domain/pricing/admissionPricingService.ts`: `setAdmissionPricing(db,
  {seriesId, effectiveDate, tiers}, actor)` (append-only insert of the batch + `recordAudit`) and
  `listAdmissionRevisions(db, seriesId)` (grouped by `effective_date`, tiers by `sort_order`).
- [X] T018 [US2] Integration test `tests/integration/admissionPricing.authz.test.ts`: `POST /api/admission-pricing`
  **refuses a base-only actor (403)** naming `parameter.write` and **allows** a `parameter.write` actor (201/200).
  (Test-first — fails until T019.)
- [X] T019 [US2] API `src/app/api/admission-pricing/route.ts` (both `withAuth({ requires: "parameter.write" })`):
  `GET ?series=<id>` → `listAdmissionRevisions`; `POST` → `setAdmissionPricing` (validate with
  `admissionPricingSetSchema`; 422 on invalid).
- [X] T020 [US2] Admin page `src/app/(admin)/admission-pricing/page.tsx` (+ `NAV` entry in
  `src/server/auth/nav.ts`, `capability: "parameter.write"`): pick a series, view its revisions, and add a new
  revision — an effective date + editable tier rows (label + dollar amount, add/remove/reorder), saved via
  `POST /api/admission-pricing` (dollars → cents with `dollarsToCents`); surface the 422.

## Phase 5: User Story 3 — A special event carries its own pricing (Priority: P2)

**Goal**: an event with `advertised_price_cents` set shows that flat override everywhere; siblings show the
series tiers; removing it reverts.
**Independent test**: give one event an override; that event shows the flat price on card + detail, a sibling
shows the series tiers.

- [X] T021 [US3] Integration test `tests/integration/admissionPricing.override.test.ts`: through the **public
  projection** — `getPublicEventDetail` for an event with `advertised_price_cents` set returns
  `pricing.kind === "flat"`; a sibling event of the same series (no override) returns `pricing.kind === "tiers"`;
  clearing the override reverts it to tiers. (The override setter already exists — feature 018's
  `event.public.write` advertised-price edit; no new setter here.)

## Phase 6: User Story 4 — A visitor reads the standing-schedule sentence (Priority: P2)

**Goal**: a curated per-series schedule sentence renders on the landing; staff can edit it.
**Independent test**: set the `ecd` series' schedule sentence (with the DST note); it renders verbatim on
`/dances/english`.

- [X] T022 [US4] Extend `src/server/domain/pricing/admissionPricingService.ts` with `setScheduleSentence(db,
  seriesId, sentence, actor)` (`recordAudit`); add route `src/app/api/admission-pricing/schedule/route.ts`
  (`POST`, `parameter.write`, validate `scheduleSentenceSchema`).
- [X] T023 [US4] Render `series.schedule_sentence` on `src/app/(public)/dances/[style]/page.tsx` (verbatim,
  omit when null); add a **schedule sentence** textarea to the admin page (`(admin)/admission-pricing/page.tsx`)
  saved via `POST /api/admission-pricing/schedule`.

## Phase 7: Polish & validation

- [X] T024 Gate suite: `pnpm exec vitest run tests/unit/publicPricing.test.ts
  tests/integration/admissionPricing.resolve.test.ts tests/integration/admissionPricing.write.test.ts
  tests/integration/admissionPricing.authz.test.ts tests/integration/admissionPricing.override.test.ts
  tests/component/pricingBlock.test.tsx`, then `pnpm exec tsc --noEmit`, `pnpm run lint`, and
  `pnpm exec prettier --check` on the changed files. Full `pnpm test` green (0037 applied). Grep the public
  surfaces to confirm no remaining hand-typed price literal (FR-011).
- [X] T025 Browser verify (quickstart §2–7): set a series' tiers → identical pricing on home, card, detail, and
  landing (card = summary), no literal `$` (SC-001/002); a later revision resolves by date (SC-003); a per-event
  override shows flat on that event only (SC-004); a no-pricing series shows no price (SC-005); the schedule
  sentence renders on the landing; a base actor can't reach `/admission-pricing` (SC-006).

## Dependencies

- **Foundational blocks all.** T001/T002 [P] → T003 → T004 → (T005 [P], T006 [P], T007 [P]) → T008 → T009.
- **US1** T010/T011 [P] (component + PricingBlock) then T012 (projection, needs T009) → T013/T014/T015 (renders).
- **US2** T016 → T017 (needs T004/T005/T008 file) → T018 → T019 → T020.
- **US3** T021 needs Foundational (resolver/override in T009) + the public projection (T012); no new setter.
- **US4** T022 → T023; needs T004 (schedule column) + T020 (admin page to extend).
- **Phase 7** last.

## Parallel opportunities

- Setup T001 ∥ T002. Foundational tests T006 ∥ T007 (and ∥ T005). US1 T010 ∥ T011.
- US1 render tasks T013/T014/T015 touch different files but all depend on T012 (the projection field rename),
  so run T012 first, then they parallelize.

## Implementation strategy

**MVP** = Foundational + **US1** + **US2** — the table + resolver + the `PublicPricing` value rendered on every
surface + the admin to set it. That delivers the core win: one edit, one consistent price everywhere, with the
hand-typed literals gone. **US3** (override) is largely delivered by the foundational resolver (verify), and
**US4** (schedule sentence) is an independent add. Single-source-first ordering: the **resolver + projection
value (T007–T009)** land in Foundational before any surface renders a price.
