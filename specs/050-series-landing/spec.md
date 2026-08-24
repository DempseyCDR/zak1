# Feature Specification: Series landing pages (P7-R6)

**Feature Branch**: `050-series-landing`

**Created**: 2026-08-23

**Status**: Draft

**Input**: User description: "P7-R6 — one rich landing page per dance style ('What is contra?' / 'What is
English?'): what it is, why you'll love it (the club's own voice/testimonials), what to expect (no partner
needed, dress, etiquette, gender-free Larks/Robins calling), the style's next dances, and a representative
photo. Use case #2, the growth funnel — migrate the existing copy, don't rewrite it. Collapse the old
five-page silo per style into one page; the roster (R9), full gallery (R11), and pricing/standing-schedule
sentence (R10) are their own features this page links to."

## Overview

The club's growth funnel is the "what is this kind of dance?" content — the pages a newcomer reads before
deciding to come. Today that content is spread across a five-page silo per style (landing / why-you'll-love /
callers-and-bands / gallery / FAQs), duplicated for contra and English. This feature collapses each silo into
**one rich, welcoming landing page per dance style**, mobile-first and styled with the P7-R1 tokens, that
answers "what is this, why would I like it, and what do I do?" and then shows **that style's upcoming dances**
(reusing the P7-R4 cards) with a representative photo. The single biggest asset is the **club's own voice**
("no partner needed", the reassuring, funny testimonial copy) — this feature **migrates that copy, it does not
rewrite it**. The performer roster (P7-R9), the full photo gallery (P7-R11), and the standing-schedule + price
sentence (P7-R10) are separate features; this page **links to** them rather than containing them.

## Clarifications

### Session 2026-08-23

- Q: How should the landing-page content (the club's migrated voice/copy) be authored for v1? → A:
  **Hand-built committed content** — the copy lives in committed content (components or a co-located
  MDX/data file); the growth funnel ships now with no CMS dependency, and P7-R7's `content_pages` CMS can
  absorb these pages later.
- Q: Which dance styles get a landing page, and where does community/family dance go? → A: **Contra (`tnc`),
  English (`ecd`), and community/family dance (`community_dance`) as its own landing** — three pages;
  `general` (joint events) gets no marketing landing.
- Q: Should the landing page show a standing schedule + price sentence now, or defer that to P7-R10? → A:
  **Defer to P7-R10** — R6 omits the "when & how much" sentence (the style's upcoming dances already convey
  when) and links to it once R10 lands; no hardcoded price/schedule to drift.
- Correction (from the migrated source copy): the role/gendered-language reassurance is **style-specific, not
  uniform**. **Contra and community** use gender-free **Larks/Robins** calling; **English** uses **traditional
  men's/women's line** terms (with some callers moving toward **positional** terms — everyone dances with
  everyone). FR-001 must not claim Larks/Robins for English.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A newcomer learns what a dance style is and that they're welcome (Priority: P1)

Someone who has never been to a contra (or English) dance lands on that style's page. In the club's own warm,
funny voice they read what the dance is, why people love it, and what to expect — crucially that **no partner
is needed**, what to wear, basic etiquette, and how the style approaches dance roles and gendered language.
They finish the page feeling invited rather than intimidated.

**Why this priority**: This is use case #2 — the growth funnel and the reason the site exists for newcomers;
the migrated voice is the club's biggest content asset.

**Independent Test**: Load a style's landing page at 375px and confirm it presents the "what it is", "why
you'll love it", and "what to expect" content (including "no partner needed", dress, etiquette, and the style's
role/gendered-language note) as one coherent, readable page.

**Acceptance Scenarios**:

1. **Given** the contra landing page, **When** it loads, **Then** it shows what contra is, why you'll love it,
   and what to expect — including "no partner needed", what to wear, etiquette, and **gender-free (Larks/Robins)
   calling** (contra's role approach).
2. **Given** the English landing page, **When** it loads, **Then** its "what to expect" reflects **English's own
   role terminology** — traditional men's/women's line terms, with some callers moving toward positional terms,
   and everyone dancing with everyone — not the contra Larks/Robins framing.
3. **Given** the club's existing copy, **When** the page renders, **Then** the migrated wording (voice/
   testimonials) is preserved, not rewritten.
4. **Given** a phone (~375px), **When** the page loads, **Then** it is readable with no horizontal scroll and
   exactly one H1.

---

### User Story 2 - See this style's upcoming dances and come to one (Priority: P1)

Having decided the style sounds appealing, the visitor immediately sees **this style's next dances** on the
same page — the same cards as `/whats-on`, filtered to this series — and can tap one to open its detail page.
The funnel goes straight from "what is this" to "here's the next one you can attend".

**Why this priority**: The landing page only converts if it connects the newcomer to an actual upcoming event;
the data and the card already exist (P7-R4).

**Independent Test**: On a style's landing page, confirm the upcoming dances shown are only that series', render
as the shared cards, and each links to its event detail page; an empty state shows when the series has none
upcoming.

**Acceptance Scenarios**:

1. **Given** upcoming dances of this style, **When** the landing page loads, **Then** they appear as the shared
   event cards, filtered to this series only.
2. **Given** a card on the landing page, **When** the visitor taps it, **Then** that event's detail page opens.
3. **Given** the series has no upcoming dances, **When** the page loads, **Then** a clear empty-state message
   shows instead of a blank area.

---

### User Story 3 - A representative photo and a coherent, on-brand page (Priority: P2)

The page opens with a representative photo of the style and is styled coherently with the rest of the public
site (P7-R1 tokens, the series' color), so it reads as a finished, inviting page and shares well.

**Why this priority**: The photo and styling make the page welcoming and shareable; valuable but secondary to
the content (US1) and the upcoming-dances connection (US2).

**Independent Test**: Confirm the landing page shows a representative photo for the style and uses that series'
color accent consistently with the cards and event detail page; a style with no photo degrades to a clean
header (no broken image).

**Acceptance Scenarios**:

1. **Given** a style with a representative photo, **When** its landing page loads, **Then** the photo is shown.
2. **Given** the style's series color, **When** the page renders, **Then** the accent matches that series'
   color on the cards and the event detail page (single source).
3. **Given** a style with no photo, **When** the page loads, **Then** a clean header renders with no broken
   image.

### Edge Cases

- **No upcoming dances for the style**: the upcoming-dances section shows a clear empty-state message.
- **No representative photo for the style**: a clean, series-colored header (no broken image).
- **Missing/optional content section** (e.g. no testimonials supplied): that section is omitted, not shown empty.
- **A style not covered by a landing page** (see Assumptions): its URL is not published; only covered styles
  have pages.
- **Long copy**: wraps/reads cleanly at 375px with no horizontal scroll.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The site MUST present **one landing page per covered dance style**, each answering **what the
  style is**, **why you'll love it** (the club's voice/testimonials), and **what to expect** — including **"no
  partner needed"**, **what to wear**, **basic etiquette**, and the **style's approach to dance roles /
  gendered language** (contra and community use **gender-free** calling — **Larks/Robins** and/or **positional**;
  English uses **traditional men's/women's line** terms, with some callers likewise moving toward **positional** —
  everyone dances with everyone). Positional calling is **not** English-specific; it is a gender-free method used
  across styles. The role/gendered-language content is **style-specific and accurate to that style** (it MUST NOT
  claim Larks/Robins for English).
- **FR-002**: The page MUST use the **club's migrated copy** (voice preserved), not rewritten content.
- **FR-003**: The page MUST show **that style's upcoming dances** using the shared event cards (P7-R4),
  **filtered to this series**, each linking to its event detail page; a clear **empty state** when none.
- **FR-004**: The page MUST show a **representative photo** for the style, degrading to a clean series-colored
  header when no photo is available.
- **FR-005**: The page MUST be **mobile-first**: readable at ~375px with **no horizontal scroll** and **exactly
  one H1**; WCAG AA contrast holds; the series color is used as an **accent** (matching the cards / event
  detail, single source).
- **FR-006**: The landing pages MUST be **reachable** from the public site's navigation (the newcomer can find
  "what is contra?").
- **FR-007**: The page MUST **link out** to the related surfaces rather than containing them: the performer
  roster (P7-R9), the full photo gallery (P7-R11), and — when available — the standing schedule + price
  (P7-R10). It MUST NOT duplicate those features.

### Key Entities

- **Dance-style landing** (a per-style content page): identified by the dance style / series; carries the
  migrated prose sections (what-it-is, why-you'll-love-it, what-to-expect / FAQ), a representative photo, and
  the series' color; composes the shared upcoming-dances list filtered to that series. The style maps to a
  club **series** (contra→`tnc`, English→`ecd`, community/family→`community_dance`) for the color, photo, and
  the dance filter.
- **Migrated copy** (the content itself): the club's existing per-style prose (landing / why-you'll-love /
  FAQ voice), supplied from the current site — preserved, not rewritten. Authored as **hand-built committed
  content** for v1 (clarified), not CMS-managed (R7 may absorb it later).

## Success Criteria *(mandatory)*

- **SC-001**: A newcomer can, from one page, learn what a dance style is and that **no partner is needed**,
  what to wear, etiquette, and the **style's approach to dance roles / gendered language** (accurate to that
  style) — at 375px, no horizontal scroll, one H1.
- **SC-002**: The page shows **only that style's** upcoming dances as the shared cards, each opening its event
  detail; an empty state shows when there are none.
- **SC-003**: The style's color accent **matches** that series' color on the cards and the event detail page.
- **SC-004**: The page shows a representative **photo** for the style, degrading to a clean header when absent.
- **SC-005**: The landing pages are **findable** from the site navigation.
- **SC-006**: The migrated **voice/copy is preserved** (not rewritten), and the page **links to** the roster,
  gallery, and schedule/price rather than duplicating them.

## Assumptions

- **Built on P7-R1 tokens (045), P7-R2 nav (046), the P7-R4 cards + `seriesColor` map (048), and the P7-R5
  `seriesHero` photo map (049)** — this branch **stacks on `049-event-detail`** so the cards, series color,
  and per-series photo are available and consistent.
- **Reuses the existing series schedule read** — `getPublicSchedule(db, from, seriesKey)` already filters
  upcoming dances by series (feature 037/048); the landing page's upcoming-dances section is that list rendered
  with the shared cards. No new query/schema is implied.
- **The migrated copy is supplied from the current site** — this feature provides the page **structure and
  composition**; the actual prose (the club's voice) is migrated in, not authored here.
- **Content source (clarified)** — **hand-built, committed content** for v1 (the copy is curated and low-churn;
  the growth funnel ships now without waiting on the CMS), with the P7-R7 / B44 `content_pages` CMS able to
  absorb these pages later. No CMS dependency in R6.
- **Styles covered + community/family placement (clarified)** — **three landing pages: contra (`tnc`), English
  (`ecd`), and community/family dance (`community_dance`) as its own landing**; `general` (joint events) gets no
  marketing landing.
- **Schedule sentence + price (clarified)** — the **standing schedule sentence and price are P7-R10**; **R6
  omits them** (the style's upcoming dances already convey when) and links to R10 when available — no hardcoded
  per-style price/schedule.

## Dependencies

- The P7-R1 tokens (045), P7-R2 nav (046), P7-R4 cards + `seriesColor` (048), and P7-R5 `seriesHero` (049) —
  this feature stacks on 049. The existing per-series public schedule read (`getPublicSchedule` with a
  `seriesKey`, feature 037), and the club series (`tnc`/`ecd`/`community_dance`/`general`). Later features this
  page links to: **P7-R9** performer rosters, **P7-R10** single-source pricing & standing schedule, **P7-R11**
  photo galleries, and **P7-R7** the content CMS (if the pages become CMS-managed).

## Out of Scope

- **Performer rosters (callers & bands)** — **P7-R9**; the landing page links to it.
- **Full photo galleries** — **P7-R11**; the landing shows one representative photo and links to the gallery.
- **Single-source pricing & the standing-schedule sentence** — **P7-R10**.
- **The content CMS / volunteer editing** — **P7-R7 / B44** (a later editability layer over these pages).
- **The org/static prose pages** (mission, policies, etc.) — **P7-R7**.
- **Any schema change or migration** — this is a content + composition feature over existing reads.
