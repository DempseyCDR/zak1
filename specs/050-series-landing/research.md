# Phase 0 Research: Series landing pages (P7-R6)

Format per decision: **Decision / Rationale / Alternatives**. The three scope choices (content source, styles
covered, schedule/price) were settled in `/speckit-clarify` (see spec Clarifications); this resolves the
implementation unknowns.

## R1. Route shape — one dynamic route `/dances/[style]` with `generateStaticParams`

**Decision**: A single dynamic route `src/app/(public)/dances/[style]/page.tsx`. The `[style]` slug (`contra` |
`english` | `community`) keys a content registry; `generateStaticParams` returns the three covered slugs (so
they prerender), and an unknown slug calls `notFound()`. Slugs are marketing-facing names, mapped in the
registry to the club **series key** (`contra`→`tnc`, `english`→`ecd`, `community`→`community_dance`) used for
the color, hero, and dance filter.

**Rationale**: Three pages that share one structure and differ only in content → one route + a registry is DRY
and keeps the copy in one editable place. `generateStaticParams` + `notFound()` publishes exactly the covered
styles. A friendly slug (`/dances/contra`) reads better than exposing the internal series key (`/dances/tnc`).

**Alternatives**: Three separate static routes (`/contra`, `/english`, `/community`) — rejected (duplicated page
scaffolding; top-level namespace clutter). `/series/[key]` keyed by the raw series key — rejected (leaks
internal keys; `general` would be a valid-looking but unpublished key).

## R2. Content source — a typed committed content registry (clarified: hand-built)

**Decision**: A co-located `landingContent.ts` exporting a typed `StyleLanding` registry keyed by slug, plus
`getStyleLanding(slug): StyleLanding | null` and `STYLE_SLUGS`. Each entry carries the `seriesKey`, the page
`title` ("What is contra?"), and the migrated prose as structured fields (`intro`, `whyYoullLove`,
`whatToExpect`). Copy is edited in this one data file without touching component logic.

**Rationale**: The clarified choice — hand-built committed content, no CMS dependency (P7-R7 can absorb it
later). A typed registry (vs. free MDX) makes the sections explicit, unit-testable, and forces every style to
supply the required content (esp. the "what to expect" reassurances). The migrated voice is dropped into this
file at implement time (as images were supplied in 047/049).

**Alternatives**: MDX-per-style — rejected for v1 (adds an MDX toolchain for three low-churn pages; harder to
assert required sections in a test). The R7 `content_pages` CMS — rejected/clarified out (R6 must not block on
building R7). Prose hardcoded in the page component — rejected (mixes copy with logic; not DRY across styles).

## R3. Content model — structured sections, migrated voice preserved

**Decision**: `StyleLanding = { slug; seriesKey; title; intro: string[]; whyYoullLove: string[]; whatToExpect:
string[] }`. `intro` = "what it is" paragraphs; `whyYoullLove` = the club's voice/testimonial paragraphs;
`whatToExpect` = the FAQ reassurances as list items (MUST include "no partner needed", what to wear, etiquette,
and the **style-appropriate** role/gendered-language note — contra & community use gender-free Larks/Robins;
English uses traditional men's/women's line terms, with some callers moving toward positional). Strings are
plain text (paragraphs/list items), so the copy stays the club's words with no rewriting.

**Rationale**: Structured-but-plain keeps the migrated voice intact while letting a test assert the required
reassurances are present. `string[]` (paragraphs / bullets) covers the real content shape without a rich-text
engine.

**Alternatives**: A single freeform HTML blob per style — rejected (no way to assert required content; XSS/rich-
text handling is R7's concern). Rich testimonial objects (author, quote) — deferred (YAGNI; paragraphs carry the
voice for v1; can enrich later).

## R4. Reuse — hero, cards, schedule read, color (no new query/schema)

**Decision**: The page composes existing pieces: **`EventHero`** (049) for the representative photo (the
per-series `seriesHero` image, or a clean series-colored header) + the series **color** via `seriesColorVar`
(048) for the title accent; the **upcoming dances** via `getPublicSchedule(db, undefined, seriesKey)` (037,
already series-filterable) rendered with **`ScheduleList`** (048); wrapped in **`Container`** (045). So a style's
card is identical here, on `/whats-on`, and on the event page.

**Rationale**: Everything the page needs already exists on the stacked branch. No new read, no schema, no
migration — the feature is composition + committed copy. Reusing `EventHero`/`ScheduleList` guarantees visual
consistency (SC-003).

**Alternatives**: A new landing-specific schedule query — rejected (`getPublicSchedule` already filters by
series). A landing-specific hero component — rejected (`EventHero` already does per-series image-or-clean-header).

## R5. Navigation — three entries in the flat PUBLIC_NAV

**Decision**: Add three entries to `PUBLIC_NAV` (`src/app/publicNavItems.ts`) — Contra, English, Community —
linking to `/dances/contra|english|community`, so the newcomer can find "what is contra?" from the site nav
(FR-006/SC-005). The R2 nav is a flat list (no dropdowns, per 046), so these are flat entries alongside What's
On / What was on / Join.

**Rationale**: `PUBLIC_NAV` is the hand-maintained single source (034 FR-003); adding entries is the intended
extension. Flat entries respect the 046 no-dropdown decision. Labels are short (the style name), not the full
"What is contra?" question, to fit the nav.

**Alternatives**: A dropdown/"Dances" group — rejected (046 chose a flat list; dropdowns are out). A single
"New here?" hub page linking to the three — deferred (more scope; three direct entries are simpler and each page
is itself the funnel entry). Home-page links only (no nav) — rejected (FR-006 requires nav reachability).

## R6. Link-outs (roster / gallery / pricing) — reserved, not fabricated

**Decision**: R6 does **not** render the roster (R9), the full gallery (R11), or the pricing/standing-schedule
sentence (R10), and does **not** invent dead links to unbuilt pages. FR-007 ("link out rather than duplicate")
is satisfied by **not duplicating** those here; the actual outbound links are added when R9/R10/R11 exist. The
content model leaves room for them without shipping broken links now.

**Rationale**: Those targets don't exist yet on this branch; a link to a 404 is worse than no link. The
requirement's intent is "don't rebuild them here", which R6 honors.

**Alternatives**: Placeholder "coming soon" links — rejected (dead-ends the newcomer). Building minimal
roster/gallery stubs here — rejected (that is R9/R11's scope; scope creep).

## R7. Testing — split by layer

**Decision**: unit `styleLanding.test.ts` — `getStyleLanding` returns the three styles with the correct
`seriesKey` mapping and non-empty required sections (asserting the "no partner needed" reassurance is present in
`whatToExpect`), and `null` for an unknown slug; `STYLE_SLUGS` covers exactly the three. Component
`landingSections.test.tsx` (jsdom) — `LandingSections` renders the intro / why-you'll-love / what-to-expect
prose (incl. "no partner needed"), uses `<h2>` section headings, and renders **no** `<h1>`. Browser-preview
(the async page reads the DB): the three pages render with hero + prose + this-series-only upcoming cards, the
color matches the card, an empty series shows the empty state, 375px no-scroll/one-H1, and the nav entries reach
the pages. The series-filtered read itself is already covered by `publicSchedule.test.ts`.

**Rationale**: The registry (data) and the pure prose component are unit/jsdom-testable; the DB-reading page and
layout facts are browser-verified, matching 048/049. No new integration test is needed — the series filter is
already proven.

**Alternatives**: Rendering the async page in jsdom — rejected (reads the DB). A new integration test for the
series filter — rejected (duplicates `publicSchedule.test.ts`'s "filters the schedule by series").
