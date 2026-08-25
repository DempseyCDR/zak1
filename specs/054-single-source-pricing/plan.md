# Implementation Plan: Single-source admission pricing & standing schedule (P7-R10)

**Branch**: `054-single-source-pricing` | **Date**: 2026-08-24 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/054-single-source-pricing/spec.md`

## Summary

Make admission pricing **data** so every public surface renders one consistent figure. A new effective-dated
`admission_prices` table holds a series' sliding-scale tiers (label + amount + order); an event resolves the
tiers effective on/before its date (mirroring the `series_parameters` resolver), with a **flat per-event
override** reusing the existing `events.advertised_price_cents` (018) for specials. A single
`resolveEventPricing` feeds a `PublicPricing` value onto the schedule projections, which the event card
(summary), event detail (full tiers), and series landing (full tiers) all render — deleting the hand-typed
price literals (e.g. the community landing's "Cost: $5…" line). A curated `series.schedule_sentence` renders
the standing-schedule text (carrying the DST-dependent English time) on the landing. Editing reuses the
existing `parameter.write` capability and audits via `audit_events`. No recurrence engine; no printable
calendar (a future consumer of the same source).

## Technical Context

**Language/Version**: TypeScript 5.7 (strict), Node 24
**Primary Dependencies**: Next.js 16 (App Router / RSC), Drizzle ORM + hand-authored SQL migrations, Zod
**Storage**: PostgreSQL 16 — additive migration `0037` (`admission_prices` table + `series.schedule_sentence`)
**Testing**: Vitest — real-Postgres integration, unit, jsdom component
**Target Platform**: Server-rendered web; mobile-first public surfaces
**Project Type**: Web application (single Next.js app)
**Performance Goals**: Standard web; a handful of series with a few tiers each — no special targets
**Constraints**: The **single-source invariant** — two surfaces showing the same event must never disagree
(one resolver, one `PublicPricing` value, derived card summary); money is integer cents rendered as USD
**Scale/Scope**: One club, ~4 series, a few tiers each. One migration, one pricing service + resolver, one
public projection value threaded onto existing surfaces, one admin page, one new capability-free API.

## Constitution Check

Constitution v1.3.0. Gates:

- **I. Test-First (NON-NEGOTIABLE)** — PASS (planned). Each area's test precedes implementation: a unit test
  for `resolveEventPricing`/`pricingSummary` (flat vs tiers vs none); an integration test for effective-dated
  tier resolution + override precedence + `setAdmissionPricing` audit + `parameter.write` authz refusal; a
  component test for the pricing render (card summary, detail tiers, empty). Tests written to fail first.
- **II. YAGNI** — PASS. Reuses: the effective-dated resolver pattern (`resolveParameterCents`/
  `resolveOngoingTotalCents`), `events.advertised_price_cents` as the flat override (no per-event tier set),
  the `parameter.write` capability, the `audit_events` sink, and the existing card/detail/landing surfaces.
  New only where required: a small `admission_prices` table (the closed `series_parameters.kind` enum can't
  hold club-labeled tiers) and one `series.schedule_sentence` column. No recurrence engine, no printable
  calendar, no per-event tiers.
- **III. Type Safety (Zod at boundaries)** — PASS. Tier input validated by Zod (label non-empty, `amount ≥ 0`
  whole cents, `effective_date` `YYYY-MM-DD`, ordered). `PublicPricing` is a discriminated union
  (`flat | tiers | null`) so a renderer handles every case; the card summary is **derived** from it, never
  stored, so it cannot disagree with the detail.
- **IV. Observability** — PASS. `setAdmissionPricing` and the schedule-sentence edit write an `audit_events`
  row via `recordAudit` (new `admission_pricing.set` kind); public reads are read-only.

No violations. Complexity Tracking: none.

## Project Structure

### Documentation (this feature)

```
specs/054-single-source-pricing/
├── spec.md · plan.md · research.md · data-model.md · quickstart.md
├── contracts/admission-pricing.md
└── checklists/requirements.md
```

### Source Code (repository root)

```
src/server/db/migrations/0037_admission_pricing.sql          # NEW — admission_prices + series.schedule_sentence
src/server/db/schema/admissionPrices.ts                       # NEW — table
src/server/db/schema/events.ts                                # series += scheduleSentence
src/server/db/schema/index.ts                                 # export admissionPrices
src/server/validation/admissionPricing.ts                     # NEW — Zod: tiers[], effectiveDate, scheduleSentence
src/server/domain/pricing/admissionPricingService.ts          # NEW — resolveAdmissionTiers, setAdmissionPricing,
                                                              #        listRevisions, setScheduleSentence (audited)
src/server/domain/public/publicPricing.ts                     # NEW — PublicPricing type, resolveEventPricing,
                                                              #        pricingSummary (card), toPublicTiers
src/server/domain/public/publicSchedule.ts                    # PublicScheduleItem/Detail: advertisedPrice → pricing
src/server/lib/audit.ts                                       # + admission_pricing.set AuditEvent kind

src/app/(public)/_components/EventCard.tsx                    # render pricingSummary(item.pricing)
src/app/(public)/_components/PricingBlock.tsx                 # NEW — full tiers / flat (detail + landing)
src/app/(public)/whats-on/[eventId]/page.tsx                  # PricingBlock instead of the $advertisedPrice line
src/app/(public)/dances/[style]/page.tsx                      # render series tiers (today) + schedule sentence
src/app/(public)/dances/landingContent.ts                     # remove the hard-coded "Cost: $5…" literal (FR-011)

src/app/api/admission-pricing/route.ts                        # NEW — GET revisions?series= , POST set (parameter.write)
src/app/api/admission-pricing/schedule/route.ts               # NEW — POST schedule sentence (parameter.write)
src/app/(admin)/admission-pricing/page.tsx                    # NEW — per-series tier editor + schedule sentence

tests/unit/publicPricing.test.ts                              # resolveEventPricing + pricingSummary
tests/integration/admissionPricing.test.ts                    # effective-dating + override + audit
tests/integration/admissionPricing.authz.test.ts              # parameter.write refusal
tests/component/pricingBlock.test.tsx                          # tiers / flat / empty render
```

**Structure Decision**: Single web app. Load-bearing choice: **one `resolveEventPricing` → `PublicPricing`**
consumed by every surface, with the card summary derived from that same value — the single-source invariant
lives in one function, so cards and detail can't drift.

## Complexity Tracking

No constitution violations; no entries.

## Phase 0 — Research

See [research.md](research.md): the **revision-as-a-batch** resolution model (tiers sharing one
`effective_date`; resolve = latest effective_date ≤ event date → all its tiers by `sort_order`), override
precedence, dedicated-table rationale, capability/audit reuse, and the card-summary rule.

## Phase 1 — Design & Contracts

- [data-model.md](data-model.md) — migration `0037`, `admission_prices`, `series.schedule_sentence`, resolution rule.
- [contracts/admission-pricing.md](contracts/admission-pricing.md) — the pricing service, the `PublicPricing`
  projection, and the admin API.
- [quickstart.md](quickstart.md) — end-to-end validation mapped to SC-001…006.
- Agent context: `CLAUDE.md` SpecKit plan reference updated to this plan.
