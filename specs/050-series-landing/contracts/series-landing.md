# Contract: series landing page

The interface this feature presents (`/dances/[style]`). No new HTTP/API endpoint — the page is
server-rendered; the "contract" is the page's content/behavior and the committed content registry.

## Page (`/dances/<style>` — `contra` | `english` | `community`)

Rendered by the server page from one `StyleLanding` entry + the series' upcoming dances:

- A **representative photo** at the top (the series' `seriesHero`), or a clean **series-colored header** when
  the style has no photo.
- **Exactly one `<h1>`** (the page title, e.g. "What is contra?") with a **series-color accent** matching that
  series' color on the cards and event page (single source via `seriesColorVar`).
- The migrated prose: **what it is**, **why you'll love it** (the club's voice), and **what to expect** —
  including **no partner needed**, **what to wear**, **etiquette**, and the **style-appropriate role/gendered-
  language note** (contra & community → gender-free Larks/Robins; English → traditional men's/women's line
  terms, some callers moving toward positional) — as `<h2>`-headed sections. Voice preserved (not rewritten).
- **This style's upcoming dances** as the shared P7-R4 cards (`getPublicSchedule` filtered to the series), each
  linking to its event detail page; a clear **empty state** when the series has none upcoming.
- Legible at ~375px with **no horizontal scroll**; WCAG AA (series color as an accent, never behind text).
- An **unknown/uncovered style** slug returns **not-found** (`generateStaticParams` publishes only the three).

**Guarantees**: a newcomer learns what the style is and that they're welcome (no partner needed) and can jump
straight to the next dance; a style's card is identical here, on `/whats-on`, and on the event page; the pages
are reachable from the site navigation.

## Content registry (`StyleLanding`)

A committed, typed per-style constant (hand-built copy — no CMS in R6): `slug`, `seriesKey` (`contra`→`tnc`,
`english`→`ecd`, `community`→`community_dance`), `title`, and the prose sections (`intro`, `whyYoullLove`,
`whatToExpect`). `getStyleLanding(slug)` → entry or `null`; `STYLE_SLUGS` drives `generateStaticParams`.

## Navigation

`PUBLIC_NAV` gains three flat entries (Contra / English / Community) → the three `/dances/<slug>` routes.

## Scope boundary

The landing page (content + this-series upcoming dances + representative photo) only. **No** performer roster
(P7-R9), **no** full photo gallery (P7-R11), **no** standing-schedule/price sentence (P7-R10), **no** content
CMS / editing (P7-R7), **no** `general` landing, **no** schema change/migration, **no** new query. The page
links out to R9/R10/R11 only once those exist.
