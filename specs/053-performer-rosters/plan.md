# Implementation Plan: Public performer rosters (bands & callers)

**Branch**: `053-performer-rosters` | **Date**: 2026-08-24 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/053-performer-rosters/spec.md`

## Summary

Expose the club's already-real bands and callers (feature 008) on a public, mobile-first roster page,
filterable by dance style, each entry showing name, bio, photo, style(s), and the performer's own
promotional links (website/social) as safe outbound links — and link a confirmed lineup on an event page
(feature 049 / R5) to the corresponding roster entry. Additive only: four small schema additions
(`is_public`, `styles`, `links` on bands & performers; `is_caller` on performers; `instrument` on
band_members), a single **public projection** module that carries the PII/visibility gate into its types
(mirroring R8 `publicVenues.ts`), one new public page with a `?style=` filter, and admin fields on the
existing performer/band editors (gated by the existing `performer.write` — no new capability). No new
dependency; promotional links render as plain anchors validated to `http(s)` at the write boundary (no
`dangerouslySetInnerHTML`).

## Technical Context

**Language/Version**: TypeScript 5.7 (strict), Node 24
**Primary Dependencies**: Next.js 16 (App Router / RSC), Drizzle ORM + hand-authored SQL migrations, Zod
**Storage**: PostgreSQL 16 — additive migration `0036` (bands/performers/band_members columns)
**Testing**: Vitest — real-Postgres integration (`tests/integration/`), unit (`tests/unit/`), jsdom
component (`tests/component/`)
**Target Platform**: Server-rendered web; mobile-first public pages
**Project Type**: Web application (single Next.js app; `src/server` domain + `src/app` routes)
**Performance Goals**: Standard web; the roster is a small directory (tens of bands/callers) — no special targets
**Constraints**: PII must never reach a public surface (gate carried in the projection type); promo-link
URL scheme allowlisted to `http(s)`; single H1, no horizontal scroll at 375px, AA contrast
**Scale/Scope**: One club; ~dozens of performers/bands. One public page, one projection module, two admin
editor extensions, one migration.

## Constitution Check

Constitution v1.3.0. Gates:

- **I. Test-First (NON-NEGOTIABLE)** — PASS (planned). Each area's test precedes its implementation:
  a unit test for the promo-link/style Zod validation; an integration test for the public projection
  gate (PII exclusion + visibility + style filter) against real Postgres; a component test for the
  roster rendering (link safety, name-only when private). Tests written to fail first.
- **II. YAGNI** — PASS. Explicit `styles`/`is_caller` (not a booking-history derivation engine); a
  single `styles text[]` + `links jsonb` column pair rather than polymorphic `promo_links`/join tables
  (the R9 doc's "warranted only if cross-owner link admin is ever needed" — it isn't); reuse existing
  `performer.write`, existing `photo_url`, existing admin pages and public-nav single source.
- **III. Type Safety (Zod at boundaries)** — PASS. All new write fields validated by Zod at the API
  boundary (style enum; `links` array of `{type ∈ enum, url: http(s)}`; `instrument`; booleans). The
  public projection returns a **gated type** (private → name-only; no contact fields selected) so the
  compiler prevents a renderer from exposing PII.
- **IV. Observability** — PASS. Public reads are read-only (no audit). Admin writes go through the
  existing performer/band PATCH routes, which already audit; the new fields ride those same writes.

No violations. Complexity Tracking: none required.

## Project Structure

### Documentation (this feature)

```
specs/053-performer-rosters/
├── spec.md
├── plan.md              # this file
├── research.md          # Phase 0 — decisions
├── data-model.md        # Phase 1 — migration 0036 + field semantics
├── contracts/
│   └── public-performers.md   # projection + admin-PATCH contracts
├── quickstart.md        # Phase 1 — validation scenarios
└── checklists/requirements.md
```

### Source Code (repository root)

```
src/server/db/migrations/0036_performer_roster.sql        # NEW — additive columns
src/server/db/schema/performers.ts                         # + isPublic, isCaller, styles, links
src/server/db/schema/bands.ts                              # + isPublic, styles, links; band_members + instrument
src/server/validation/performers.ts                        # + styles/links/isPublic/isCaller (create+patch)
src/server/validation/bands.ts                             # + styles/links/isPublic; member instrument
src/server/domain/public/promoLinks.ts                     # NEW — PromoLink type + zod (type enum, http(s) url)
src/server/domain/public/publicPerformers.ts               # NEW — the gate: PublicBand/PublicCaller + listers
src/server/domain/bands/publicDisplay.ts                   # PublicBandBlock += bandId, isPublic (lineup link)
src/server/domain/public/performerDisplay.ts               # full_bio performer += performerId, isPublic
src/server/domain/public/publicSchedule.ts                 # thread bandId/isPublic through PublicBandBlock

src/app/(public)/performers/page.tsx                       # NEW — roster page + ?style= filter
src/app/(public)/performers/performers.module.css          # NEW
src/app/(public)/_components/PromoLinks.tsx                # NEW — safe outbound-link list
src/app/(public)/_components/Lineup.tsx                    # link band/caller names to roster when public
src/app/publicNavItems.ts                                  # + { href: "/performers", label: "Performers" }

src/app/(admin)/manage/performers/…                        # add is_public / is_caller / styles / links (moved
                                                           # from (admin)/performers so /performers is the PUBLIC roster)
src/app/(admin)/bands/…                                    # add is_public / styles / links + member instrument

tests/unit/promoLinks.test.ts                              # NEW — validation (scheme allowlist, type enum)
tests/integration/publicPerformers.test.ts                 # NEW — the gate (PII, visibility, style filter)
tests/component/roster.test.tsx                            # NEW — render + link safety + private name-only
```

**Structure Decision**: Single web app. The load-bearing choice is the **single public projection
module** (`publicPerformers.ts`) that every public read consumes — the same shape R8 used for venues:
the projection type is nullable/narrowed so a private or PII field can never be handed to a renderer.

## Complexity Tracking

No constitution violations; no entries.

## Phase 0 — Research

See [research.md](research.md). Resolved: style storage (`text[]` column), links storage
(`jsonb` array), caller identity (`is_caller`), instrument (`band_members.instrument`), visibility
(`is_public` on both), filter mechanism (server `?style=`, mirroring the R6/037 series filter),
lineup-link mechanism (anchors + projection flags), link safety (`rel="noopener noreferrer nofollow"`,
`http(s)` allowlist), and capability reuse.

## Phase 1 — Design & Contracts

- [data-model.md](data-model.md) — migration `0036` and field semantics.
- [contracts/public-performers.md](contracts/public-performers.md) — the public projection functions and
  the extended admin PATCH payloads.
- [quickstart.md](quickstart.md) — end-to-end validation scenarios.
- Agent context: the `CLAUDE.md` SpecKit plan reference is updated to point here.
