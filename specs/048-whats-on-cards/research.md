# Phase 0 Research: `/whats-on` mobile-first event cards

Format per decision: **Decision / Rationale / Alternatives**. The three UX/data choices (lineup,
series→color map, per-series vs grouped) were settled in `/speckit-clarify` and are recorded in the spec;
this file resolves the implementation unknowns.

## R1. Projection fields — add `seriesKey` + `venueShortName`, no migration

**Decision**: Extend `PublicScheduleItem` with **`seriesKey: string`** and **`venueShortName: string |
null`**, populated by adding `series.key` and `venues.short_name` to the existing `listPublicEvents`
`SELECT`. Both source columns are already available — `series` is inner-joined, `venues` is left-joined —
so this is two extra selected columns, **no schema change, no migration**. The two fields are required keys
on the type (the projection always provides them; `venueShortName`'s *value* is nullable because
`venues.short_name` is nullable and the venue join is a left join).

**Rationale**: The card needs the series (for color) and the short venue name; the data exists and the
query already joins both tables — the minimal, YAGNI change. Making the keys required keeps the type honest
and forces fixtures to supply them.

**Alternatives**: Compute the series→color on the card from `activity` (the series *name*) (rejected —
brittle string matching vs. a stable key); a second query for venue short names (rejected — the join
already has it); optional fields (rejected — every real item has a series, and the card always wants both).

## R2. Series → R1-color map (clarified) — per-series code constant + neutral default

**Decision**: A small co-located module `seriesColor.ts` exporting a per-series map (keyed by series key):
`tnc`→`contra`, `ecd`→`english`, `community_dance`→`special`, `general`→`assembly`; any other/unmapped key
→ a **neutral default**. It resolves to the R1 CSS variables via `EVENT_TYPE_COLORS`
(`var(--type-contra)` …); the neutral default reuses the existing **`var(--band)`** token (steel-blue) —
distinct from the five type colors and on-brand, so **no change to R1's `globals.css`**. `meeting` is
reserved for future meeting events (no dance series maps to it).

**Rationale**: Mirrors R1's `EVENT_TYPE_COLORS` pattern (a typed code constant, single source), is trivially
unit-testable, and needs no DB colour storage (the palette is a fixed brand constant — B45/R1 rationale).
Reusing `--band` for the default avoids editing a merged R1 file.

**Alternatives**: A `series.color` DB column (rejected — premature; colours are brand constants, not
admin-edited data); adding a `--type-default` token to `globals.css` (rejected — touches merged R1; `--band`
already serves as a neutral accent).

## R3. Card structure — accent as a stripe, color never behind text

**Decision**: `EventCard` renders the whole card as a `<Link href="/whats-on/<id>">` (whole-card tap,
≥44px), styled from R1 tokens: a **left accent stripe** (`border-left: 4px solid var(--card-accent)`) whose
colour is set per card via an inline CSS variable `style={{ "--card-accent": seriesColorVar(seriesKey) }}`;
a **prominent date** block; then time, venue short name (fallback to full name, or omit if neither), and
price (omit when null); a **cancelled marker** when cancelled. The series colour is used **only** as the
stripe/marker accent (UI 3:1 threshold, which all type colours pass), never as a background behind
normal-size text, so WCAG AA holds regardless of colour.

**Rationale**: A border-stripe accent is the standard, AA-safe way to colour-code a card (it carries no
text-contrast burden); the CSS-variable-per-card keeps the colour data-driven with zero inline layout
styling. Whole-card link satisfies "tap anywhere" (SC-002) + the ≥44px target.

**Alternatives**: A coloured background block behind the date/text (rejected — fails AA for `--type-meeting`
and risks it for others; the accent-only rule from R1 R3); a coloured chip/badge only (fine, but a stripe
reads faster when scanning a stack — could add a chip too, optional).

## R4. Retained behavior — filter, cancelled, empty state, confirmed-only

**Decision**: `SeriesFilter` + the `?series=` server-rendered filter, the cancelled marker (018/B25), the
empty-state message, and the confirmed-bookings-only public rule (018) are **unchanged** — the card is
purely a new presentation of the same `listPublicEvents` rows.

**Rationale**: The spec (FR-004/FR-007/FR-008) keeps these; nothing about cards requires touching the
filter or the query's row set.

## R5. Testing — split by what each layer can prove

**Decision**: unit `seriesColor.test.ts` (map correctness incl. neutral default); component
`eventCard.test.tsx` (jsdom, `next/link` stubbed) — whole-card link href, prominent date + time + venue-
short (and fallback to full when short is null) + price (omitted when null), cancelled marker, the
`--card-accent` variable set from the series map, and no `<h1>`; integration
`publicSchedule.cards.test.ts` (real Postgres) — seed an event with a series + a venue short name and
assert `getPublicSchedule` items carry the correct `seriesKey` and `venueShortName`. **Update**
`scheduleList.test.tsx`: its fixtures gain `seriesKey`/`venueShortName` (required now) and its assertions
move from rows to cards (still whole-card links to `/whats-on/<id>`). Above-the-fold, 375px no-scroll, and
tap-size are browser-preview checks.

**Rationale**: Each layer is tested where it's provable; the projection change gets a real-Postgres test
(constitution: integration on real infra), and the existing shared-component test is kept green.

**Alternatives**: Rendering `/whats-on` (async RSC) in jsdom (rejected — reads the DB; not jsdom-
renderable); asserting pixel above-the-fold in jsdom (rejected — no layout engine).
