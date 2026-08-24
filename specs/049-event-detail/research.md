# Phase 0 Research: Event detail page enrichment (P7-R5)

Format per decision: **Decision / Rationale / Alternatives**. The three UX/data choices (hero source,
directions note, lineup shape) were settled in `/speckit-clarify` (see spec Clarifications); this file resolves
the implementation unknowns those answers imply.

## R1. Projection additions — `seriesKey` + band `members`, no migration

**Decision**: Extend `PublicEventDetail` with **`seriesKey: string`** (select `series.key` — the detail query
already inner-joins `series`) and extend **`PublicBandBlock`** with **`members: { name: string; isLead: boolean
}[]`**. The members come from the roster `getBand` **already returns** (`BandWithRoster.members` =
`{ performerId, performerName, isLead }[]`) inside `groupEventBookingsForDisplay` — which currently maps only
`{ bandId, name, bio, photoUrl }` into its `BandBlock` and **discards the roster**. So carrying members is a
mapping change over data already fetched: **no new query, no schema change, no migration**.

**Rationale**: The page needs the series key for the color treatment + hero (FR-005/FR-004) and the band members
for the lineup (FR-003). Both are one hop from data the read already has. Making `seriesKey` a required field
mirrors R4's `PublicScheduleItem.seriesKey` (single color source across card and page).

**Alternatives**: Re-derive the color from `activity` (the series *name*) — rejected (brittle; R4 already chose
the key). A separate query for band members — rejected (the roster is already loaded by `getBand`). Snapshotting
members at booking time — rejected (band identity is a live read by design, per `groupEventBookingsForDisplay`).

## R2. Series → hero image — per-series committed static asset (clarified), null default

**Decision**: A co-located `seriesHero.ts` exporting `seriesHeroSrc(seriesKey): string | null` — a map from
series key to a **committed static asset path** under `public/series/` (e.g. `tnc` → `/series/tnc.webp`); any
series without a committed image → **`null`** → the page renders a clean, series-colored header (no `<img>`).
Assets are **curated, committed, low-churn** (D-4); **no upload substrate**. Mirrors R4's `seriesColor` (a typed
constant, no DB image column).

**Rationale**: Cheapest sufficient approach (clarified) — one image per dance style, not per event; the null
default makes "no image yet" a first-class, testable state rather than a broken image. `next/image` needs a
known path; a code map supplies it without DB storage.

**Alternatives**: Per-event image or DB `events.image_url` — rejected (D-4 defers uploads; per-event curation is
premature). Reusing a booked band's `photoUrl` as the hero — rejected in clarification (uneven across events;
couples hero to lineup). A `--series-hero` CSS background — rejected (`next/image` gives sizing/lazy/`alt`
without a background-image hack).

**Note (assets)**: the committed images are club-curated photos (as `public/hero.webp` was supplied for 047).
The map includes only series that have a committed file; verification uses whatever is committed (at least one
series wired to a real image to demonstrate the hero, the rest exercising the clean-header path).

## R3. Lineup shape — bands grouped with members + callers, "to be announced" empty state

**Decision**: `Lineup` takes the projection's `bandBlocks` (now with `members`) and `performers` (the existing
public non-band entries — callers/`name_note`/`full_bio`/`open_band`). Render each **band** as a block: its name
(+ bio/photo as today) and its **members by name**, lead first; then the **callers / other performers** from
`performers`. When there is **no confirmed band and no performers**, render a single **"Lineup to be announced"**
line instead of an empty section. Confirmed-only is enforced **upstream** (`groupEventBookingsForDisplay`
filters to `status === "confirmed"`), so the component needs no status logic.

**Rationale**: Matches the clarified answer and reuses the existing public performer mapping (callers already
arrive via `mapPublicPerformers`). The empty state is the spec's FR-003 requirement. Keeping status-filtering
upstream keeps the component pure and jsdom-testable.

**Alternatives**: A flat name list with no band grouping — rejected in clarification. Re-deriving confirmed-only
in the component — rejected (already done in the projection; would duplicate the 018 rule).

## R4. Instruments — not in the data model; render members by name (graceful "when available")

**Decision**: `performers` has **no instrument field** (only `displayName`, `bio`, `photoUrl`, `contactId`), and
`band_members` carries only `isLead`. So "members **and instruments when available**" resolves to **members by
name** today; no instrument is shown because none exists. **No instrument field is added** here (out of scope —
a future feature if wanted). `isLead` is available and MAY order/label the lead.

**Rationale**: YAGNI + honest to the model. The spec's "when available" language deliberately covers the
absent-data case; adding an instrument column is a separate decision with its own admin UI.

**Alternatives**: Add `band_members.instrument` now — rejected (out of scope, needs a booker-facing editor;
not requested for v1). Parse instruments from bios — rejected (unreliable).

## R5. Directions note — deferred to R8; venue block shows name + map link only

**Decision**: The `VenueBlock` renders the venue **name** and the **map link** (`venue.mapUrl`, already on the
projection — an `<img>` when `MAPS_STATIC_KEY` is set, else a Google Maps `<a>`, per `venueMapUrl`). The
**directions/transit/parking note** is **P7-R8** (`venues.directions`, not yet in the schema): the block leaves a
**slot** that renders the note only once that field exists, and R5 **adds no venue schema/data**. When there is
no venue, the block is omitted.

**Rationale**: Clarified boundary — R5 does not pull R8's schema forward. The map link already works today;
directions is purely additive later.

**Alternatives**: Add `venues.directions` in R5 — rejected (that is R8's scope). Hardcode per-venue directions
in code — rejected (data belongs in R8's field, editable by the venue admin).

## R6. Series color treatment on the page — accent, matching the card

**Decision**: Use `seriesColorVar(seriesKey)` (R4's map) to set a `--series-accent` on the page and apply it as
an **accent** — a header rule/stripe near the series/title and/or a thin top accent — never behind normal-size
text (R1/R4 AA rule). The same series is therefore the same color on its card and its page (FR-005/SC-002).

**Rationale**: Single source of truth for series color; reusing the R4 map guarantees the card↔page match with
no new palette.

**Alternatives**: A colored hero overlay tint — possible but risks text contrast over the image; keep the accent
off the image. A per-series full-bleed color band behind the title text — rejected (AA risk for `--type-meeting`,
same as R4 R3).

## R7. Testing — split by layer

**Decision**: unit `seriesHero.test.ts` (path per mapped series; `null` for unmapped). Component (jsdom):
`eventHero.test.tsx` — a mapped series renders an `<img>` with the mapped `src` + non-empty `alt`; an unmapped
series renders a clean header with **no** `<img>`, and no `<h1>` (the page owns it). `lineup.test.tsx` — a band
with members + a caller both render (members by name, lead present); an empty lineup renders "Lineup to be
announced"; no `<h1>`. Integration `publicEventDetail.detail.test.ts` (real Postgres) — seed an event, a venue,
a band with a two-member roster, a confirmed booking under that band, plus a non-confirmed booking; assert
`getPublicEventDetail` returns `seriesKey`, the band block with both members, and **excludes** the non-confirmed
booking. Full-page 375px/no-scroll/one-H1/hero/color-match are browser-preview checks (the page is an async RSC
that reads the DB — not jsdom-renderable, per 048).

**Rationale**: Each layer tested where it's provable; the projection change gets a real-Postgres test
(constitution: integration on real infra); the pure components are jsdom-tested; layout facts are browser-checked.

**Alternatives**: Render the async page in jsdom — rejected (reads the DB). Assert pixel above-the-fold in jsdom
— rejected (no layout engine).
