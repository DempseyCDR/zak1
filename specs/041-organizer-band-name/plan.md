# Implementation Plan: Organizer Report Shows the Band Name (+ member detail on drill-in)

**Branch**: `041-organizer-band-name` | **Date**: 2026-08-06 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/041-organizer-band-name/spec.md`

## Summary

Change the organizer report's per-dance **band** field from the joined member names to the **band's name** when a
named band is booked (falling back to joined names for ad-hoc, "Open Band", or blank — all unchanged), and surface
the band name on the page's existing per-dance **detail expansion**, which already lists each performer by name and
role. Technically this is a **display-only reshape of one string field** plus a tiny page label: the report already
loads each dance's bookings (which carry `bandId`) and performer names; the band name is looked up from a
`bandId → bands.name` map. **No schema change, no new endpoint, no computed figure changes.**

## Technical Context

**Language/Version**: TypeScript 5.7 (strictest flags)

**Primary Dependencies**: Next.js 16 App Router (RSC) · Drizzle · the organizer domain (`reportService.ts`) + the
`/organizer/[seriesKey]` page; reuses the `bands` table (`bands.name`) and the existing `bandId` on each booking
(`BookingView = BookingRow & { performerName }`, so `bandId` is already present).

**Storage**: PostgreSQL — **no migration**. Reads existing columns only (`bookings.band_id`, `bands.name`).

**Testing**: Vitest against real Postgres — integration on `assembleOrganizerReport` (band name for a named-band
dance, joined names for ad-hoc, "Open Band"/blank, multiple bands, plus a **figure-parity** guard) + a component
test (jsdom) on the page (band column shows the band name; the expanded detail lists members by name and role and
shows the band name). Test-first.

**Target Platform**: Web (Next.js App Router) + Postgres

**Project Type**: Single Next.js + Postgres web app

**Performance Goals**: N/A — one extra small query (all bands → a `bandId → name` map) loaded once per report, not
per event (avoids N+1).

**Constraints**: **Display-only** — no computed figure may change (FR-005/FR-008, SC-004); scope is the
**organizer** report only (the public `/whats-on` band display and the bookings report are out of scope).

**Scale/Scope**: 2 source edits (reportService, organizer page — the page edit is a small detail label), 2 test
files (1 extended, 1 new component test), an optional `makeBand` test helper, 0 migrations, 0 new endpoints.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Test-First (NON-NEGOTIABLE)** — PASS. New behavior is codified RED-first: an integration assertion that a
  named-band dance's `band` equals the band's name (and ad-hoc → joined names, open-band → "Open Band", multiple
  bands → joined names), plus a **parity** assertion that dancers/gross/performer-total/dance-net/averages are
  unchanged; a component test asserts the band column shows the name and the drill-in detail lists members by name
  and role.
- **II. Simplicity / YAGNI** — PASS. No schema, no new endpoint, no new field — the `band` **string** changes
  meaning (member names → band name), the band name comes from the existing `bands` table via the existing
  `bandId` on each booking, and the detail **reuses** the page's existing inline per-dance expansion (which
  already lists performers). One small query (a `bandId → name` map, loaded once) mirrors the bookings-report's
  band-name lookup.
- **III. Type Safety** — PASS. `band` stays a `string`; the report GET has no request body, so no new Zod
  boundary. `tsc` covers the page's local report type (unchanged shape).
- **IV. Observability** — PASS (unchanged). No endpoint added or removed; no new audit surface.

**Result**: All gates pass. Complexity Tracking empty.

## Project Structure

### Documentation (this feature)

```text
specs/041-organizer-band-name/
├── plan.md · research.md · data-model.md · quickstart.md
├── contracts/organizer-report.md
├── checklists/requirements.md
└── tasks.md            # /speckit-tasks (NOT created here)
```

### Source Code (repository root)

```text
EDIT:
  src/server/domain/organizer/reportService.ts        # `band` field → the booked band's NAME: load a
                                                       #   bandId→name map once (db.select from bands); collect
                                                       #   distinct non-null bandIds among lead/musician bookings
                                                       #   → join their names; else joined member names (ad-hoc);
                                                       #   else "Open Band"; else "". Also set the trend point's
                                                       #   `band`. NO figure change; `performers[]` unchanged.
  src/app/(admin)/organizer/[seriesKey]/page.tsx       # detail expansion: surface the band name (reuse `r.band`)
                                                       #   above the existing performers list (members already
                                                       #   shown as `name (type, amount)`) — small label only

TESTS:
  tests/integration/organizer.report.test.ts           # named-band → band name; ad-hoc → joined names;
                                                       #   open-band → "Open Band"; multiple bands → joined names;
                                                       #   figure-parity guard (existing figures unchanged)
  tests/component/organizer.page.test.tsx  (NEW)        # jsdom: band column shows the band name; the expanded
                                                       #   detail lists members by name + role and shows the band
  tests/integration/helpers/factories.ts (optional)    # small makeBand helper (insert a bands row) to seed a
                                                       #   named band; the test may also insert directly

NO migration · NO new route (GET organizer report already returns the assembled report; `band` stays a string).
```

**Structure Decision**: Single Next.js + Postgres project. The only behavioral change is the **meaning** of the
existing `band` string on each per-dance row (and the identical trend point): member-name join → the booked band's
name, resolved from a `bandId → bands.name` map loaded once (mirroring the bookings-report's `bands` lookup,
batched to avoid N+1). Non-band cases keep today's fallbacks. The drill-in **member detail already exists** on the
page (the row expands to list `performers` as `name (type, amount)`); the page edit only adds the band name label
there, so US2 is largely delivered by the existing UI once the service change lands. Figure parity (FR-005/SC-004)
is the load-bearing invariant — nothing but the `band` string changes.

## Complexity Tracking

> No Constitution Check violations — table intentionally empty.
